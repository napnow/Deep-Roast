import { handleRoute, jsonOk } from "@/server/http";
import { listUserConversations } from "@/server/services/admin";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/users/[id]/conversations
export const GET = handleRoute(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  return jsonOk(await listUserConversations(id));
});
