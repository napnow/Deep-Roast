import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, privateNoStore } from "@/server/http";
import {
  countImageVersionGroup,
  deleteImageVersionGroup,
} from "@/server/services/image";

type Ctx = { params: Promise<{ groupId: string }> };

export const GET = handleRoute(async (req, ctx: Ctx) => {
  const { userId } = await requireActiveUser(req);
  const { groupId } = await ctx.params;
  return privateNoStore(jsonOk(await countImageVersionGroup(userId, groupId)));
});

export const DELETE = handleRoute(async (req, ctx: Ctx) => {
  const { userId } = await requireActiveUser(req);
  const { groupId } = await ctx.params;
  return jsonOk(await deleteImageVersionGroup(userId, groupId));
});
