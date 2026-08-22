import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { listAdminInvitations } from "@/server/services/invitations";

export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get("limit") || 200);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 200, 1),
    500,
  );
  return jsonOk(await listAdminInvitations(limit));
});
