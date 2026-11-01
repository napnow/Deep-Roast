import { requireActiveUser } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import {
  MAX_POLISH_PROMPT_LENGTH,
  POLISH_PROMPT_CREDIT_COST,
  polishPrompt,
} from "@/server/services/polish-prompt";
import { reserveCredits } from "@/server/services/credits";
import { readIdempotencyKey } from "@/server/services/request-idempotency";
import {
  beginRequest,
  completeRequest,
  failRequest,
  inProgressError,
  requestErrorBody,
  requestErrorStatus,
} from "@/server/services/request-idempotency-store";

// 润色限流：每用户 10 次/分钟。计费失败退款，不占用额外生成配额。
const POLISH_LIMIT = 10;
const POLISH_WINDOW = 60;

// POST /api/polish-prompt — 忠实润色文生图提示词
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit(
    "polish-user",
    user.userId,
    POLISH_LIMIT,
    POLISH_WINDOW,
  );

  const body = await readJson<{ prompt?: string }>(req);
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) throw new ApiError("请先输入画面描述", 400);
  if (prompt.length > MAX_POLISH_PROMPT_LENGTH) {
    throw new ApiError(
      `画面描述不能超过 ${MAX_POLISH_PROMPT_LENGTH} 个字符`,
      400,
    );
  }

  const claim = await beginRequest(
    user.userId,
    "prompt-polish",
    readIdempotencyKey(req),
  );
  if (claim.kind === "replay") return jsonOk(claim.body, claim.status);
  if (claim.kind === "in_progress") throw inProgressError();

  try {
    const chargeCredits = user.role !== "admin";
    const reservation = chargeCredits
      ? await reserveCredits(
          user.userId,
          POLISH_PROMPT_CREDIT_COST,
          `提示词润色: ${prompt.slice(0, 50)}`,
        )
      : null;

    try {
      const result = await polishPrompt({ prompt });
      await completeRequest(claim.id, claim.leaseToken, 200, result);
      return jsonOk(result);
    } catch (error) {
      if (reservation) {
        try {
          await reservation.refund("提示词润色失败退款");
        } catch (refundError) {
          console.error("Polish prompt refund error:", refundError);
        }
      }
      throw error;
    }
  } catch (error) {
    await failRequest(
      claim.id,
      claim.leaseToken,
      requestErrorStatus(error),
      requestErrorBody(error),
    ).catch((recordError) =>
      console.error("Failed to persist polish prompt failure", recordError),
    );
    throw error;
  }
});
