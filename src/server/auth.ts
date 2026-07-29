/**
 * 从 middleware 注入的 header 读取当前用户。
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError } from "@/server/http";

export interface RequestUser {
  userId: string;
  username: string;
  role: string;
}

export function getRequestUser(req: Request): RequestUser | null {
  const userId = req.headers.get("x-user-id");
  if (!userId) return null;
  return {
    userId,
    username: req.headers.get("x-user-username") || "",
    role: req.headers.get("x-user-role") || "user",
  };
}

export function requireUser(req: Request): RequestUser {
  const user = getRequestUser(req);
  if (!user) throw new ApiError("未登录", 401);
  return user;
}

/** 校验未封禁；业务 API 优先使用 */
export async function requireActiveUser(req: Request): Promise<RequestUser> {
  const user = requireUser(req);
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

export function requireAdmin(req: Request): RequestUser {
  const user = requireUser(req);
  if (user.role !== "admin") throw new ApiError("无权限", 403);
  return user;
}

export async function requireActiveAdmin(req: Request): Promise<RequestUser> {
  const user = await requireActiveUser(req);
  if (user.role !== "admin") throw new ApiError("无权限", 403);
  return user;
}

/** 兼容旧代码：只取 userId */
export function getUserIdFromHeaders(req: Request): string | null {
  return req.headers.get("x-user-id");
}
