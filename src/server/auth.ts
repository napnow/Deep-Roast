/**
 * 从 middleware 注入的 header 读取当前用户。
 */

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

export function requireAdmin(req: Request): RequestUser {
  const user = requireUser(req);
  if (user.role !== "admin") throw new ApiError("无权限", 403);
  return user;
}

/** 兼容旧代码：只取 userId */
export function getUserIdFromHeaders(req: Request): string | null {
  return req.headers.get("x-user-id");
}
