import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import { generateImage } from "@/server/services/image";
import { enforceRateLimit } from "@/server/rate-limit";
import { readIdempotencyKey } from "@/server/services/request-idempotency";
import {
  beginRequest,
  completeRequest,
  failRequest,
  inProgressError,
  requestErrorBody,
  requestErrorStatus,
} from "@/server/services/request-idempotency-store";

// 生图限流：每用户 10 次/分钟
const IMAGE_LIMIT = 10;
const IMAGE_WINDOW = 60;

// POST /api/image — generate image from text prompt
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit("image-user", user.userId, IMAGE_LIMIT, IMAGE_WINDOW);
  const body = await readJson<{
    prompt?: string;
    model?: string;
    size?: string;
  }>(req);
  const claim = await beginRequest(
    user.userId,
    "image-generation",
    readIdempotencyKey(req),
  );
  if (claim.kind === "replay") return jsonOk(claim.body, claim.status);
  if (claim.kind === "in_progress") throw inProgressError();

  try {
    const result = await generateImage({
      userId: user.userId,
      role: user.role,
      prompt: body.prompt || "",
      modelOverride: body.model,
      size: body.size,
      idempotencyKey: claim.key,
    });
    await completeRequest(claim.id, claim.leaseToken, 200, result);
    return jsonOk(result);
  } catch (error) {
    await failRequest(
      claim.id,
      claim.leaseToken,
      requestErrorStatus(error),
      requestErrorBody(error),
    ).catch(
      (recordError) =>
        console.error("Failed to persist image request failure", recordError),
    );
    throw error;
  }
});
