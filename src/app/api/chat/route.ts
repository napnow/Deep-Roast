import { requireUser } from "@/server/auth";
import { handleRoute, readJson } from "@/server/http";
import { createChatStream } from "@/server/services/chat";

// POST /api/chat — SSE streaming chat
export const POST = handleRoute(async (req) => {
  const { userId } = requireUser(req);
  const body = await readJson<{ conversationId?: string; message?: string }>(
    req,
  );
  return createChatStream(
    userId,
    body.conversationId || "",
    body.message || "",
  );
});
