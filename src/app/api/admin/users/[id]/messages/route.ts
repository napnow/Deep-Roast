import { ApiError, handleRoute, jsonOk } from "@/server/http";
import { listConversationMessages } from "@/server/services/admin";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/users/[id]/messages?conversationId=
export const GET = handleRoute(async (req, _ctx: Ctx) => {
  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (!conversationId) throw new ApiError("conversationId 为必填项", 400);
  return jsonOk(await listConversationMessages(conversationId));
});
