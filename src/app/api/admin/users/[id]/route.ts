import { requireActiveAdmin } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { deleteUserHard, setUserStatus } from "@/server/services/admin";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id] — { status: 'active' | 'banned' }
export const PATCH = handleRoute(async (req, _ctx) => {
  await requireActiveAdmin(req);
  const { id } = await (_ctx as Ctx).params;
  const body = await readJson<{ status?: string }>(req);
  if (body.status !== "active" && body.status !== "banned") {
    throw new ApiError("status 须为 active 或 banned", 400);
  }
  return jsonOk(await setUserStatus(id, body.status));
});

// DELETE /api/admin/users/[id]
export const DELETE = handleRoute(async (req, _ctx) => {
  await requireActiveAdmin(req);
  const { id } = await (_ctx as Ctx).params;
  return jsonOk(await deleteUserHard(id));
});
