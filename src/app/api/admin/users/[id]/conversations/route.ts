import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { listUserConversations } from "@/server/services/admin";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/users/[id]/conversations — 管理端查看用户对话列表
export const GET = handleRoute(async (req, ctx: Ctx) => {
  await requireActiveAdmin(req);
  const { id } = await ctx.params;
  return jsonOk(await listUserConversations(id));
});
