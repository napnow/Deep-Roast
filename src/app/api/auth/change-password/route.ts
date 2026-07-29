import { verifyToken } from "@/lib/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { changeOwnPassword } from "@/server/services/auth-password";

function tokenFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
  return tokenMatch ? decodeURIComponent(tokenMatch[1]!) : null;
}

export const POST = handleRoute(async (req) => {
  const token = tokenFromCookie(req);
  if (!token) throw new ApiError("未登录", 401);

  const payload = await verifyToken(token);
  if (!payload?.userId) throw new ApiError("登录已过期", 401);

  const body = await readJson<{ oldPassword?: string; newPassword?: string }>(
    req,
  );
  await changeOwnPassword(
    payload.userId,
    body.oldPassword || "",
    body.newPassword || "",
  );
  return jsonOk({ success: true });
});
