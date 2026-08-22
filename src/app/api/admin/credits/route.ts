import { requireActiveAdmin } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import {
  adjustCredits,
  listAdminTransactions,
} from "@/server/services/credits";

// GET /api/admin/credits
export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  const { searchParams } = new URL(req.url);
  return jsonOk(
    await listAdminTransactions({
      userId: searchParams.get("userId"),
      type: searchParams.get("type"),
    }),
  );
});

// POST /api/admin/credits
export const POST = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  const body = await readJson<{
    userId?: string;
    amount?: number;
    note?: string;
  }>(req);
  if (!body.userId) throw new ApiError("参数不完整", 400);
  return jsonOk(
    await adjustCredits(body.userId, body.amount || 0, body.note),
  );
});
