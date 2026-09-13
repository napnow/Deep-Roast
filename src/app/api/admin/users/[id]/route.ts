import { requireActiveAdmin } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import {
  deleteUserHard,
  setUserCleanupProtected,
  setUserStatus,
} from "@/server/services/admin";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id] — { status: 'active' | 'banned' }
export const PATCH = handleRoute(async (req, _ctx) => {
  await requireActiveAdmin(req);
  const { id } = await (_ctx as Ctx).params;
  const body = await readJson<{
    status?: string;
    cleanupProtected?: unknown;
  }>(req);
  if (body.cleanupProtected !== undefined) {
    if (body.status !== undefined || typeof body.cleanupProtected !== "boolean") {
      throw new ApiError("cleanupProtected 须为布尔值且不能与 status 同时更新", 400);
    }
    return jsonOk(await setUserCleanupProtected(id, body.cleanupProtected));
  }
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
