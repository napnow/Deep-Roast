import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { comparePassword, hashPassword } from "@/lib/auth";
import { ApiError } from "@/server/http";

export const MIN_PASSWORD_LENGTH = 8;

/** Alphanumeric without 0 O I l 1 */
const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function assertPasswordLength(password: string): void {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(`密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`, 400);
  }
}

/**
 * 密码强度校验：至少 8 位，且同时包含字母、数字、符号。
 * 用于注册与改密（管理员重置生成强随机临时密码，不经过此校验）。
 */
export function assertPasswordStrength(password: string): void {
  assertPasswordLength(password);
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  if (!hasLetter || !hasDigit || !hasSymbol) {
    throw new ApiError(
      `密码至少需要 ${MIN_PASSWORD_LENGTH} 位，且同时包含字母、数字和符号`,
      400,
    );
  }
}

export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i]! % TEMP_PASSWORD_ALPHABET.length];
  }
  return out;
}

export async function changeOwnPassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  if (!oldPassword || !newPassword) {
    throw new ApiError("旧密码和新密码不能为空", 400);
  }
  assertPasswordStrength(newPassword);
  if (newPassword === oldPassword) {
    throw new ApiError("新密码不能与旧密码相同", 400);
  }

  const [user] = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new ApiError("用户不存在", 404);
  }

  const ok = await comparePassword(oldPassword, user.password);
  if (!ok) {
    throw new ApiError("旧密码不正确", 401);
  }

  const hashed = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function adminResetPassword(
  userId: string,
  opts: { password?: string; generate?: boolean },
): Promise<{ username: string; temporaryPassword?: string }> {
  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new ApiError("用户不存在", 404);
  }

  let plain: string;
  let returnTemp = false;

  if (opts.generate) {
    plain = generateTemporaryPassword(12);
    returnTemp = true;
  } else if (opts.password) {
    assertPasswordStrength(opts.password);
    plain = opts.password;
  } else {
    throw new ApiError("请提供 password 或 generate: true", 400);
  }

  const hashed = await hashPassword(plain);
  await db
    .update(users)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return returnTemp
    ? { username: user.username, temporaryPassword: plain }
    : { username: user.username };
}
