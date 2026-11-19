import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { deleteImageVersionGroup } from "@/server/services/image";

type Ctx = { params: Promise<{ groupId: string }> };

export const DELETE = handleRoute(async (req, ctx: Ctx) => {
  const { userId } = await requireActiveUser(req);
  const { groupId } = await ctx.params;
  return jsonOk(await deleteImageVersionGroup(userId, groupId));
});
