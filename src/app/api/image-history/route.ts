import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { listImageHistory } from "@/server/services/image";

// GET /api/image-history
export const GET = handleRoute(async (req) => {
  const { userId } = await requireActiveUser(req);
  return jsonOk(await listImageHistory(userId));
});
