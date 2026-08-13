import { requireActiveUser } from "@/server/auth";
import { handleRoute, readJson } from "@/server/http";
import { createChatStream } from "@/server/services/chat";

// POST /api/chat — SSE streaming chat
export const POST = handleRoute(async (req) => {
  const { userId, role } = await requireActiveUser(req);
  const body = await readJson<{ conversationId?: string; message?: string }>(
    req,
  );
  return createChatStream(userId, role, body.conversationId || "", body.message || "");
});
