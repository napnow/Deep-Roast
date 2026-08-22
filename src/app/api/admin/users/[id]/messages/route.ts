import { ApiError, handleRoute, jsonOk } from "@/server/http";
import { requireActiveAdmin } from "@/server/auth";
import { listConversationMessages } from "@/server/services/admin";

// GET /api/admin/users/[id]/messages?conversationId= — 管理端查看对话消息
export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (!conversationId) throw new ApiError("conversationId 为必填项", 400);
  return jsonOk(await listConversationMessages(conversationId));
});
