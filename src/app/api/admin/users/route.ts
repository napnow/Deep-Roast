import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { listUsersWithStats } from "@/server/services/admin";

// GET /api/admin/users
export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  return jsonOk(await listUsersWithStats());
});
