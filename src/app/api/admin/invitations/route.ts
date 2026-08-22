import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import {
  listAdminInvitations,
  normalizeInvitationListQuery,
} from "@/server/services/invitations";

export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  const { searchParams } = new URL(req.url);
  const { limit, offset } = normalizeInvitationListQuery(
    searchParams.get("limit"),
    searchParams.get("offset"),
  );
  return jsonOk(await listAdminInvitations(limit, offset));
});
