/**
 * 请求鉴权：从 Cookie 解析并验证 JWT（Node Runtime，可读 JWT_SECRET）。
 * 不依赖 middleware 注入 header——middleware 运行在 Edge Runtime，
 * 无法安全获取 JWT_SECRET（非 NEXT_PUBLIC_ 变量不注入 edge bundle）。
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError } from "@/server/http";
import { verifyToken } from "@/lib/auth";

export interface RequestUser {
  userId: string;
  username: string;
  role: string;
}

/** 从请求 Cookie 解析 JWT 并验证，失败返回 null */
export async function resolveUserFromRequest(
  req: Request,
): Promise<RequestUser | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  return {
    userId: payload.userId as string,
    username: payload.username as string,
    role: payload.role as string,
  };
}

/** 兼容旧调用：从 cookie 解析当前用户（已登录返回，否则 null） */
export async function getRequestUser(
  req: Request,
): Promise<RequestUser | null> {
  return resolveUserFromRequest(req);
}

/** 校验未封禁；业务 API 优先使用 */
export async function requireActiveUser(req: Request): Promise<RequestUser> {
  const user = await resolveUserFromRequest(req);
  if (!user) throw new ApiError("未登录", 401);

  const [row] = await db
    .select({ status: users.status, role: users.role })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);
  if (!row) throw new ApiError("未登录", 401);
  if (row.status === "banned") {
    throw new ApiError("账号已被封禁，请联系管理员", 403);
  }
  return { ...user, role: row.role || user.role };
}

/** 管理员校验（route 内部用） */
export async function requireAdmin(req: Request): Promise<RequestUser> {
  const user = await requireActiveUser(req);
  if (user.role !== "admin") throw new ApiError("无权限", 403);
  return user;
}

/** 校验未封禁的管理员（管理后台 API 用） */
export async function requireActiveAdmin(req: Request): Promise<RequestUser> {
  const user = await requireActiveUser(req);
  if (user.role !== "admin") throw new ApiError("无权限", 403);
  return user;
}

/** 兼容旧代码：只取 userId */
export function getUserIdFromHeaders(req: Request): string | null {
  return req.headers.get("x-user-id");
}
