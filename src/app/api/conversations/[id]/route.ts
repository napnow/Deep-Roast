import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  deleteConversation,
  getConversationWithMessages,
  updateConversation,
} from "@/server/services/conversations";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/conversations/[id]
export const GET = handleRoute(async (req, ctx: Ctx) => {
  const { userId } = await requireActiveUser(req);
  const { id } = await ctx.params;
  return jsonOk(await getConversationWithMessages(userId, id));
});

// PATCH /api/conversations/[id]
export const PATCH = handleRoute(async (req, ctx: Ctx) => {
  const { userId } = await requireActiveUser(req);
  const { id } = await ctx.params;
  const body = await readJson<{ title?: string; model?: string }>(req);
  return jsonOk(
    await updateConversation(userId, id, {
      title: body.title,
      model: body.model,
    }),
  );
});

// DELETE /api/conversations/[id]
export const DELETE = handleRoute(async (req, ctx: Ctx) => {
  const { userId } = await requireActiveUser(req);
  const { id } = await ctx.params;
  return jsonOk(await deleteConversation(userId, id));
});
