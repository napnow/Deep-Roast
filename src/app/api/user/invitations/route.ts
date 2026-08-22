import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { getUserInvitationData } from "@/server/services/invitations";

export const GET = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  return jsonOk(await getUserInvitationData(user.userId, user.role, req));
});
