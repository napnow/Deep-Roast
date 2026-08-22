import { requireActiveAdmin } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { adminResetPassword } from "@/server/services/auth-password";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/users/[id]/reset-password
export const POST = handleRoute(async (req, ctx: Ctx) => {
  await requireActiveAdmin(req);
  const { id } = await ctx.params;
  if (!id) throw new ApiError("缺少用户 id", 400);

  const body = await readJson<{ password?: string; generate?: boolean }>(req);

  if (!body.generate && !body.password) {
    throw new ApiError("请提供 password 或 generate: true", 400);
  }

  const result = await adminResetPassword(id, {
    password: body.password,
    generate: body.generate === true,
  });

  return jsonOk({
    success: true,
    username: result.username,
    ...(result.temporaryPassword
      ? { temporaryPassword: result.temporaryPassword }
      : {}),
  });
});
