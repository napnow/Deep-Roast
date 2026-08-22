import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  createConversation,
  listConversations,
} from "@/server/services/conversations";

// GET /api/conversations
export const GET = handleRoute(async (req) => {
  const { userId } = await requireActiveUser(req);
  return jsonOk(await listConversations(userId));
});

// POST /api/conversations
export const POST = handleRoute(async (req) => {
  const { userId } = await requireActiveUser(req);
  const body = await readJson<{ title?: string; model?: string }>(req);
  return jsonOk(await createConversation(userId, body), 201);
});
