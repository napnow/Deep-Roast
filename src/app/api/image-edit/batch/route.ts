import { requireActiveUser } from "@/server/auth";
import {
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
  requestErrorStatus,
} from "@/server/services/request-idempotency-store";

// 批量图生图限流：每用户 3 次/分钟（每张图内部还有单张接口的限流兜底）
const BATCH_LIMIT = 3;
const BATCH_WINDOW = 60;

// POST /api/image-edit/batch — 同参考图批量生成变体（最多 5 张）
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit(
    "image-batch-user",
    user.userId,
    BATCH_LIMIT,
    BATCH_WINDOW,
  );
  const body = await readJson<ImageEditRequest>(req, {
    maxBytes: IMAGE_EDIT_JSON_MAX_BYTES,
  });
  const claim = await beginRequest(
    user.userId,
    "image-edit-batch",
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
      count: body.count,
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
        console.error("Failed to persist image batch request failure", recordError),
    );
    throw error;
  }
});
