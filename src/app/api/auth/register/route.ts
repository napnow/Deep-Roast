import { db } from "@/db";
import { users, creditTransactions, registrationRecords } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { ApiError } from "@/server/http";
import { assertPasswordStrength } from "@/server/services/auth-password";
import { isRegistrationEnabled } from "@/server/services/site-settings";
import { enforceRateLimit, getClientIp } from "@/server/rate-limit";

// 注册限流：同一 IP 10 次/小时
const REGISTER_IP_LIMIT = 10;
const REGISTER_WINDOW = 3600;

/** 生产环境白名单 IP（逗号分隔），这些 IP 不受单 IP 注册限制 */
const BYPASS_IPS = (process.env.REGISTRATION_BYPASS_IPS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function shouldSkipIpLimit(ip: string): boolean {
  // 开发环境不做单 IP 限制（方便本地测试）
  if (process.env.NODE_ENV !== "production") return true;
  return BYPASS_IPS.includes(ip);
}

/** 注册 IP 占位冲突（registration_records.ip unique） */
function isIpUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code === "23505") return true;
  // drizzle 会包装 pg 错误，code 可能丢失：按错误消息兜底匹配
  const msg = e?.message || "";
  return msg.includes("registration_records") && /duplicate|already exists/i.test(msg);
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    await enforceRateLimit(
      "register-ip",
      ip,
      REGISTER_IP_LIMIT,
      REGISTER_WINDOW,
    );

    if (!(await isRegistrationEnabled())) {
      return Response.json({ error: "暂不开放注册" }, { status: 403 });
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    if (username.length < 2 || username.length > 32) {
      return Response.json({ error: "用户名需要 2-32 个字符" }, { status: 400 });
    }

    try {
      assertPasswordStrength(password);
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    if (existing.length > 0) {
      return Response.json({ error: "用户名已存在" }, { status: 409 });
    }

    // 单 IP 限注册一个账号：先预检（常规路径），再占位（并发竞态由
    // unique 约束兜底）；后续注册流程失败时回滚占位，避免误锁 IP。
    const ipLimitActive = !shouldSkipIpLimit(ip);
    const [ipRecord] = ipLimitActive
      ? await db
          .select()
          .from(registrationRecords)
          .where(eq(registrationRecords.ip, ip))
      : [];
    if (ipLimitActive && ipRecord) {
      return Response.json(
        { error: "该网络地址已注册过账号，如有疑问请联系管理员" },
        { status: 403 },
      );
    }

    try {
      if (ipLimitActive) {
        await db.insert(registrationRecords).values({ ip, username });
      }
    } catch (err) {
      if (isIpUniqueViolation(err)) {
        return Response.json(
          { error: "该网络地址已注册过账号，如有疑问请联系管理员" },
          { status: 403 },
        );
      }
      throw err;
    }

    try {
      const hashed = await hashPassword(password);

      const [user] = await db
        .insert(users)
        .values({ username, password: hashed, credits: 50 })
        .returning();

      await db.insert(creditTransactions).values({
        userId: user.id,
        type: "signup_bonus",
        amount: 50,
        balanceAfter: 50,
        note: "新用户注册赠送",
      });

      const token = await signToken({
        userId: user.id,
        username: user.username,
        role: user.role,
      });
      await setAuthCookie(token);

      return Response.json(
        { success: true, username: user.username, role: user.role },
        { status: 201 },
      );
    } catch (err) {
      // 注册失败（用户名并发冲突等）：释放 IP 占位
      await db
        .delete(registrationRecords)
        .where(eq(registrationRecords.ip, ip))
        .catch(() => {});
      throw err;
    }
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: err.headers },
      );
    }
    console.error("[register] 未预期错误:", err);
    return Response.json({ error: "注册失败，请重试" }, { status: 500 });
  }
}
