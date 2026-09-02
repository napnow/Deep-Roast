import { requireActiveUser } from "@/server/auth";
import {
  ApiError,
  handleRoute,
  IMAGE_EDIT_JSON_MAX_BYTES,
  jsonOk,
  readJson,
} from "@/server/http";
import { runImageEditTasks } from "@/server/services/image";
import { enforceRateLimit } from "@/server/rate-limit";
import type { ImageEditRequest } from "@/lib/image-edit-contract";
import { readIdempotencyKey } from "@/server/services/request-idempotency";
import {
  beginRequest,
  completeRequest,
  failRequest,
  inProgressError,
  requestErrorBody,
} from "@/server/services/request-idempotency-store";

const IMAGE_LIMIT = 10;
const IMAGE_WINDOW = 60;

export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit("image-user", user.userId, IMAGE_LIMIT, IMAGE_WINDOW);
  const body = await readJson<ImageEditRequest>(req, {
    maxBytes: IMAGE_EDIT_JSON_MAX_BYTES,
  });
  const claim = await beginRequest(
    user.userId,
    "image-edit",
    readIdempotencyKey(req),
  );
  if (claim.kind === "replay") return jsonOk(claim.body, claim.status);
  if (claim.kind === "in_progress") throw inProgressError();

  try {
    const result = await runImageEditTasks({
      userId: user.userId,
      role: user.role,
      request: body,
      modelOverride: body.model,
      size: body.size,
      count: 1,
      idempotencyKey: claim.key,
    });
    if (result.succeeded === 0) {
      throw new ApiError(result.lastError || "图生图失败", 500);
    }
    await completeRequest(claim.id, 200, result);
    return jsonOk(result);
  } catch (error) {
    await failRequest(claim.id, 500, requestErrorBody(error)).catch((recordError) =>
      console.error("Failed to persist image edit request failure", recordError),
    );
    throw error;
  }
});
