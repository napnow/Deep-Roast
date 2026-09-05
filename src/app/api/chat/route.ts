import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import { createChatStream, replayChatStream } from "@/server/services/chat";
import { readIdempotencyKey } from "@/server/services/request-idempotency";
import {
  beginRequest,
  failRequest,
  inProgressError,
  requestErrorBody,
  requestErrorStatus,
} from "@/server/services/request-idempotency-store";

// POST /api/chat — SSE streaming chat
export const POST = handleRoute(async (req) => {
  const { userId, role } = await requireActiveUser(req);
  const body = await readJson<{ conversationId?: string; message?: string }>(
    req,
  );
  const claim = await beginRequest(userId, "chat", readIdempotencyKey(req));
  if (claim.kind === "replay") {
    return claim.status >= 400
      ? jsonOk(claim.body, claim.status)
      : replayChatStream(claim.body);
  }
  if (claim.kind === "in_progress") throw inProgressError();

  try {
    return await createChatStream(
      userId,
      role,
      body.conversationId || "",
      body.message || "",
      {
        requestId: claim.id,
        requestLeaseToken: claim.leaseToken,
        idempotencyKey: claim.key,
      },
    );
  } catch (error) {
    await failRequest(
      claim.id,
      claim.leaseToken,
      requestErrorStatus(error),
      requestErrorBody(error),
    ).catch(
      (recordError) =>
        console.error("Failed to persist chat request failure", recordError),
    );
    throw error;
  }
});
