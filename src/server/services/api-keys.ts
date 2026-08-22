import { and, count, eq, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { ApiError } from "@/server/http";
import { decryptApiKey, encryptApiKey } from "./api-key-crypto";

const KEY_PREFIX = "sk-dr-";
export const MAX_API_KEYS_PER_USER = 10;

export function assertApiKeyQuota(existingCount: number): void {
  if (existingCount >= MAX_API_KEYS_PER_USER) {
    throw new ApiError("API Key 数量已达上限", 429, "API_KEY_QUOTA");
  }
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string | null;
  usageCount: number;
  creditsConsumed: number;
  recoverable: boolean;
}

interface RecoverableFields {
  keyCiphertext: string | null;
  keyIv: string | null;
  keyAuthTag: string | null;
}

export function hasRecoverableSecret(
  value: RecoverableFields,
): value is { keyCiphertext: string; keyIv: string; keyAuthTag: string } {
  return Boolean(value.keyCiphertext && value.keyIv && value.keyAuthTag);
}

export type MutableApiKeyStatus = "active" | "disabled";

export function normalizeApiKeyStatus(value: unknown): MutableApiKeyStatus {
  if (value === "active" || value === "disabled") return value;
  throw new ApiError("无效的 Key 状态", 400);
}

export function apiKeyUsageDelta(credits: number) {
  return { usageCount: 1, creditsConsumed: Math.max(0, Math.floor(credits)) };
}

export function assertApiKeyOwnership(targetUserId: string, ownerUserId: string) {
  if (targetUserId !== ownerUserId) throw new ApiError("Key 不存在", 404);
}

const recordSelection = {
  id: apiKeys.id,
  name: apiKeys.name,
  keyPrefix: apiKeys.keyPrefix,
  status: apiKeys.status,
  usageCount: apiKeys.usageCount,
  creditsConsumed: apiKeys.creditsConsumed,
  lastUsedAt: apiKeys.lastUsedAt,
  createdAt: apiKeys.createdAt,
  keyCiphertext: apiKeys.keyCiphertext,
  keyIv: apiKeys.keyIv,
  keyAuthTag: apiKeys.keyAuthTag,
};

interface ApiKeyRecordRow extends RecoverableFields {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  usageCount: number;
  creditsConsumed: number;
  lastUsedAt: Date | null;
  createdAt: Date | null;
}

function toRecord(row: ApiKeyRecordRow): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name ?? "",
    keyPrefix: row.keyPrefix ?? "",
    status: row.status ?? "active",
    usageCount: row.usageCount ?? 0,
    creditsConsumed: row.creditsConsumed ?? 0,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    recoverable: hasRecoverableSecret(row),
  };
}

function buildKeyMaterial() {
  const plainKey = generateKey();
  const encrypted = encryptApiKey(plainKey);
  return {
    plainKey,
    keyHash: hashKey(plainKey),
    keyPrefix: plainKey.slice(0, 12),
    keyCiphertext: encrypted.ciphertext,
    keyIv: encrypted.iv,
    keyAuthTag: encrypted.authTag,
  };
}

export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ plainKey: string; record: ApiKeyRecord }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    const [existing] = await tx
      .select({ keyCount: count() })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));
    assertApiKeyQuota(Number(existing?.keyCount || 0));

    const material = buildKeyMaterial();
    const [row] = await tx
      .insert(apiKeys)
      .values({
        userId,
        name: name.trim().slice(0, 60),
        keyHash: material.keyHash,
        keyPrefix: material.keyPrefix,
        keyCiphertext: material.keyCiphertext,
        keyIv: material.keyIv,
        keyAuthTag: material.keyAuthTag,
      })
      .returning(recordSelection);

    return { plainKey: material.plainKey, record: toRecord(row) };
  });
}

export async function getApiKeySecret(
  userId: string,
  keyId: string,
): Promise<{ plainKey: string }> {
  const [row] = await db
    .select({
      keyCiphertext: apiKeys.keyCiphertext,
      keyIv: apiKeys.keyIv,
      keyAuthTag: apiKeys.keyAuthTag,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .limit(1);

  if (!row) throw new ApiError("Key 不存在", 404);
  if (!hasRecoverableSecret(row)) {
    throw new ApiError("旧版 Key 无法恢复，请重新生成", 409, "API_KEY_NOT_RECOVERABLE");
  }

  try {
    return {
      plainKey: decryptApiKey({
        ciphertext: row.keyCiphertext,
        iv: row.keyIv,
        authTag: row.keyAuthTag,
      }),
    };
  } catch {
    throw new ApiError(
      "暂时无法读取，请重新生成或联系管理员",
      500,
      "API_KEY_DECRYPT_FAILED",
    );
  }
}

export async function rotateApiKey(
  userId: string,
  keyId: string,
): Promise<{ plainKey: string; record: ApiKeyRecord }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    const [existing] = await tx
      .select({ id: apiKeys.id, name: apiKeys.name })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1);
    if (!existing) throw new ApiError("Key 不存在", 404);

    const material = buildKeyMaterial();
    await tx
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));
    const [row] = await tx
      .insert(apiKeys)
      .values({
        userId,
        name: existing.name,
        keyHash: material.keyHash,
        keyPrefix: material.keyPrefix,
        keyCiphertext: material.keyCiphertext,
        keyIv: material.keyIv,
        keyAuthTag: material.keyAuthTag,
      })
      .returning(recordSelection);

    return { plainKey: material.plainKey, record: toRecord(row) };
  });
}

export async function listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
  const rows = await db
    .select(recordSelection)
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt);
  return rows.map(toRecord);
}

export async function listUserApiKeysForAdmin(userId: string) {
  return listApiKeys(userId);
}

export async function createUserApiKeyForAdmin(userId: string, name: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new ApiError("用户不存在", 404);
  const result = await createApiKey(userId, name);
  return { record: result.record };
}

export async function updateUserApiKeyStatusForAdmin(
  userId: string,
  keyId: string,
  status: MutableApiKeyStatus,
) {
  const [owner] = await db
    .select({ userId: apiKeys.userId })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1);
  if (!owner) throw new ApiError("Key 不存在", 404);
  assertApiKeyOwnership(userId, owner.userId);
  const [row] = await db
    .update(apiKeys)
    .set({ status })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning(recordSelection);
  return toRecord(row);
}

export async function deleteUserApiKeyForAdmin(userId: string, keyId: string) {
  const [row] = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });
  if (!row) throw new ApiError("Key 不存在", 404);
}

export async function recordApiKeyUsage(keyId: string, credits: number) {
  const delta = apiKeyUsageDelta(credits);
  await db
    .update(apiKeys)
    .set({
      usageCount: sql`${apiKeys.usageCount} + ${delta.usageCount}`,
      creditsConsumed: sql`${apiKeys.creditsConsumed} + ${delta.creditsConsumed}`,
      lastUsedAt: new Date(),
    })
    .where(eq(apiKeys.id, keyId));
}

export async function revokeApiKey(id: string, userId: string) {
  const [row] = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });
  if (!row) throw new ApiError("Key 不存在", 404);
  return { success: true };
}

/** 通过 Bearer token 解析 API key，并校验 Key 与用户状态。 */
export async function resolveApiKeyUser(
  token: string,
): Promise<{ userId: string; username: string; role: string; apiKeyId: string }> {
  if (!token.startsWith(KEY_PREFIX)) {
    throw new ApiError("无效的 API Key", 401);
  }
  const hash = hashKey(token);
  const [row] = await db
    .select({
      userId: apiKeys.userId,
      keyId: apiKeys.id,
      status: apiKeys.status,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);
  if (!row) throw new ApiError("无效的 API Key", 401);
  if (row.status !== "active") {
    throw new ApiError("API Key 已停用", 403);
  }

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  if (!user) throw new ApiError("账号不存在", 401);
  if (user.status === "banned") {
    throw new ApiError("账号已被封禁", 403);
  }

  return { userId: user.id, username: user.username, role: user.role, apiKeyId: row.keyId };
}
