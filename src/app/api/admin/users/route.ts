import { handleRoute, jsonOk } from "@/server/http";
import { listUsersWithStats } from "@/server/services/admin";

// GET /api/admin/users
export const GET = handleRoute(async () => {
  return jsonOk(await listUsersWithStats());
});
