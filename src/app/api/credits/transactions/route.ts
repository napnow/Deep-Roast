import { requireUser } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { listUserTransactions } from "@/server/services/credits";

// GET /api/credits/transactions — 用户积分流水
export const GET = handleRoute(async (req) => {
  const { userId } = requireUser(req);
  return jsonOk(await listUserTransactions(userId));
});
