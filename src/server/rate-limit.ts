/**
 * Redis 频率限流（固定窗口）。
 * - 优先使用 Redis（生产部署推荐，多实例共享计数）
 * - REDIS_URL 未配置或连接失败时降级为进程内内存限流（单实例可用）
 */

import Redis from "ioredis";
import { ApiError } from "@/server/http";

let redisClient: Redis | null = null;
let redisFailed = false;

function getRedis(): Redis | null {
  if (redisClient || redisFailed) return redisClient;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    redisFailed = true;
    return null;
  }
  try {
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: null,
    });
    client.connect().catch(() => {
      redisFailed = true;
      redisClient = null;
      console.warn("[rate-limit] Redis 连接失败，降级为进程内内存限流");
    });
    redisClient = client;
    return client;
  } catch {
    redisFailed = true;
    return null;
  }
}

// ── 内存降级实现（单实例） ──
const memBuckets = new Map<string, { count: number; resetAt: number }>();
const MEM_MAX_KEYS = 5000;

function memCheck(
  key: string,
  limit: number,
  windowSeconds: number,
): void {
  const now = Date.now();
  if (memBuckets.size > MEM_MAX_KEYS) {
    // 简单清理：淘汰已过期条目
    for (const [k, b] of memBuckets) {
      if (b.resetAt <= now) memBuckets.delete(k);
    }
  }
  const bucket = memBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    memBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return;
  }
  if (bucket.count >= limit) {
    throw rateLimitError(bucket.resetAt - now);
  }
  bucket.count += 1;
}

// ── Redis 固定窗口 ──
async function redisCheck(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memCheck(key, limit, windowSeconds);
    return;
  }
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (count > limit) {
      const ttl = await redis.ttl(key);
      throw rateLimitError((ttl > 0 ? ttl : windowSeconds) * 1000);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Redis 异常时降级内存，保证服务可用
    redisFailed = true;
    redisClient = null;
    memCheck(key, limit, windowSeconds);
  }
}

function rateLimitError(_retryAfterMs: number): ApiError {
  // 刻意不回显剩余秒数：避免帮攻击者精确计时、同步调整爆破节奏
  return new ApiError("请求过于频繁，请稍后再试", 429, "RATE_LIMITED");
}

/** 获取客户端 IP（兼容反代头） */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * 频率限制：超限抛 429 ApiError。
 * @param namespace 限流类别（如 login-ip / image-user）
 * @param id 维度标识（IP / 用户名 / userId）
 * @param limit 窗口内允许次数
 * @param windowSeconds 窗口秒数
 */
export async function enforceRateLimit(
  namespace: string,
  id: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const key = `rl:${namespace}:${id}`;
  const redis = getRedis();
  if (redis) {
    await redisCheck(key, limit, windowSeconds);
  } else {
    memCheck(key, limit, windowSeconds);
  }
}

// ── 账号级登录失败锁定（防分布式爆破） ──
// 无论攻击者用多少代理 IP，锁的是账号本身：连续 MAX_LOGIN_FAILURES 次
// 密码错误后锁定 LOGIN_LOCK_SECONDS，期间该账号任何来源均不可登录。

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCK_SECONDS = 15 * 60;
const FAIL_WINDOW_SECONDS = 15 * 60;

interface LockState {
  failures: number;
  lockedUntil: number; // 0 = 未锁定
}

const memLocks = new Map<string, LockState>();
const MEM_LOCK_MAX_KEYS = 5000;

function memLockCleanup(): void {
  if (memLocks.size <= MEM_LOCK_MAX_KEYS) return;
  const now = Date.now();
  for (const [k, s] of memLocks) {
    if (s.lockedUntil <= now && s.failures === 0) memLocks.delete(k);
  }
}

async function redisRecordFailure(lockKey: string, failKey: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return memRecordFailure(lockKey, failKey);
  try {
    const count = await redis.incr(failKey);
    if (count === 1) {
      await redis.expire(failKey, FAIL_WINDOW_SECONDS);
    }
    if (count >= MAX_LOGIN_FAILURES) {
      await redis.set(lockKey, "1", "EX", LOGIN_LOCK_SECONDS);
    }
    return count;
  } catch {
    redisFailed = true;
    redisClient = null;
    return memRecordFailure(lockKey, failKey);
  }
}

function memRecordFailure(lockKey: string, failKey: string): number {
  memLockCleanup();
  const now = Date.now();
  const s = memLocks.get(lockKey) || { failures: 0, lockedUntil: 0 };
  // 锁定窗口已过：重置计数
  if (s.lockedUntil > 0 && s.lockedUntil <= now) {
    s.failures = 0;
    s.lockedUntil = 0;
  }
  s.failures += 1;
  if (s.failures >= MAX_LOGIN_FAILURES) {
    s.lockedUntil = now + LOGIN_LOCK_SECONDS * 1000;
  }
  memLocks.set(lockKey, s);
  void failKey;
  return s.failures;
}

async function redisLockRemainingMs(lockKey: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return memLockRemainingMs(lockKey);
  try {
    const ttl = await redis.ttl(lockKey);
    return ttl > 0 ? ttl * 1000 : 0;
  } catch {
    redisFailed = true;
    redisClient = null;
    return memLockRemainingMs(lockKey);
  }
}

function memLockRemainingMs(lockKey: string): number {
  const s = memLocks.get(lockKey);
  if (!s || s.lockedUntil <= Date.now()) return 0;
  return s.lockedUntil - Date.now();
}

async function redisClearLock(lockKey: string, failKey: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memClearLock(lockKey);
    return;
  }
  try {
    await redis.del(lockKey, failKey);
  } catch {
    redisFailed = true;
    redisClient = null;
    memClearLock(lockKey);
  }
}

function memClearLock(lockKey: string): void {
  memLocks.delete(lockKey);
}

function accountLockKey(username: string): string {
  return `lock:login-user:${username}`;
}

/** 检查账号是否处于锁定中；已锁定则抛 423 */
export async function assertAccountNotLocked(username: string): Promise<void> {
  const remaining = await redisLockRemainingMs(accountLockKey(username));
  if (remaining <= 0) return;
  throw new ApiError(
    "登录失败次数过多，账号已临时锁定，请稍后再试",
    423,
    "ACCOUNT_LOCKED",
  );
}

/**
 * 记录一次登录失败；达到阈值时锁定账号。
 * 返回当前累计失败次数。
 */
export async function recordLoginFailure(username: string): Promise<number> {
  const count = await redisRecordFailure(
    accountLockKey(username),
    `fail:login-user:${username}`,
  );
  if (count >= MAX_LOGIN_FAILURES) {
    throw new ApiError(
      "登录失败次数过多，账号已临时锁定，请稍后再试",
      423,
      "ACCOUNT_LOCKED",
    );
  }
  return count;
}

/** 登录成功后清除失败计数与锁定状态 */
export async function clearLoginFailures(username: string): Promise<void> {
  await redisClearLock(
    accountLockKey(username),
    `fail:login-user:${username}`,
  );
}
