import { handleRoute, jsonOk } from "@/server/http";
import { getPublicDonation } from "@/server/services/site-settings";

// GET /api/public/donation — 用户端查询打赏配置（开关/收款码/文案）
export const GET = handleRoute(async () => {
  return jsonOk(await getPublicDonation());
});
