import { requireApiUser } from "@/server/auth";
import {
  ApiError,
  apiV1CorsPreflight,
  handleRoute,
  jsonOk,
  readJson,
} from "@/server/http";
import { generateImage } from "@/server/services/image";
import { enforceRateLimit } from "@/server/rate-limit";
import { assertCanonicalPublicOrigin } from "@/server/services/security-guards";
import { recordApiKeyUsage } from "@/server/services/api-keys";
import { CREDIT_PER_IMAGE } from "@/types";
import { createImageAccessToken } from "@/server/services/private-images";
import { readIdempotencyKey } from "@/server/services/request-idempotency";
import {
  beginRequest,
  completeRequest,
  failRequest,
  inProgressError,
  requestErrorBody,
  requestErrorStatus,
} from "@/server/services/request-idempotency-store";

// 中转限流：每个用户每分钟最多 10 次文生图请求（防刷带宽/上游额度）
const GATEWAY_LIMIT = 10;
const GATEWAY_WINDOW = 60;
// 单次请求最多生成张数（防恶意大 n 消耗）
const MAX_N = 4;

type StoredImageResult = {
  storageKey?: string;
  imageUrl: string;
};

function renderStoredImageResponse(
  body: Record<string, unknown>,
  userId: string,
  origin: string,
): Record<string, unknown> {
  const images = Array.isArray(body.images)
    ? body.images.filter(
        (item): item is StoredImageResult =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as StoredImageResult).imageUrl === "string",
      )
    : null;
  // Compatibility for records written before storage-key replay was added.
  if (!images) return body;
  return {
    created:
      typeof body.created === "number"
        ? body.created
        : Math.floor(Date.now() / 1000),
    data: images.map((result) => {
      if (!result.storageKey) return { url: `${origin}${result.imageUrl}` };
      const token = createImageAccessToken(result.storageKey, userId);
      return {
        url: `${origin}${result.imageUrl}?user=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`,
      };
    }),
  };
}

export const OPTIONS = apiV1CorsPreflight;

// POST /api/v1/images/generations — OpenAI 兼容文生图中转
export const POST = handleRoute(async (req) => {
  const user = await requireApiUser(req);
  await enforceRateLimit("gateway-image", user.userId, GATEWAY_LIMIT, GATEWAY_WINDOW);

  const body = await readJson<{
    model?: string;
    prompt?: string;
    n?: number;
    size?: string;
  }>(req);
  const claim = await beginRequest(
    user.userId,
    "api-v1-image-generation",
    readIdempotencyKey(req),
  );
  if (claim.kind === "replay") {
    if (claim.status >= 400) return jsonOk(claim.body, claim.status);
    const origin = assertCanonicalPublicOrigin(process.env.PUBLIC_APP_URL);
    return jsonOk(
      renderStoredImageResponse(claim.body, user.userId, origin),
      claim.status,
    );
  }
  if (claim.kind === "in_progress") throw inProgressError();

  try {
    const prompt = (body.prompt || "").trim();
    const n = Math.min(Math.max(Math.floor(body.n || 1) || 1, 1), MAX_N);
    const size = body.size || "1024x1024";
    const model = body.model;
    if (!prompt) throw new ApiError("prompt 为必填项", 400);

    const results = [];
    for (let i = 0; i < n; i++) {
      const result = await generateImage({
        userId: user.userId,
        role: user.role,
        prompt,
        size,
        modelOverride: model,
        idempotencyKey: `${claim.key}:${i}`,
      });
      results.push(result);
    }

    if (user.apiKeyId) {
      const consumedCredits =
        user.role === "admin" ? 0 : results.length * CREDIT_PER_IMAGE;
      await recordApiKeyUsage(user.apiKeyId, consumedCredits).catch((error) => {
        console.error("Failed to record API key usage", error);
      });
    }

    const origin = assertCanonicalPublicOrigin(process.env.PUBLIC_APP_URL);
    const storedBody = {
      created: Math.floor(Date.now() / 1000),
      images: results.map((result) => ({
        storageKey: result.storageKey,
        imageUrl: result.imageUrl,
      })),
    };
    await completeRequest(claim.id, claim.leaseToken, 200, storedBody);
    const responseBody = renderStoredImageResponse(
      storedBody,
      user.userId,
      origin,
    );
    return jsonOk(responseBody);
  } catch (error) {
    await failRequest(
      claim.id,
      claim.leaseToken,
      requestErrorStatus(error),
      requestErrorBody(error),
    ).catch((recordError) =>
      console.error("Failed to persist v1 image request failure", recordError),
    );
    throw error;
  }
});
