import { requireUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import { rechargeCredits } from "@/server/services/credits";

// POST /api/credits/recharge — 模拟充值
export const POST = handleRoute(async (req) => {
  const { userId } = requireUser(req);
  const body = await readJson<{ planId?: string }>(req);
  const result = await rechargeCredits(userId, body.planId || "");
  return jsonOk(result);
});
