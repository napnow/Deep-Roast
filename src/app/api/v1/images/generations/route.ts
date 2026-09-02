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
} from "@/server/services/request-idempotency-store";

const GATEWAY_LIMIT = 10;
const GATEWAY_WINDOW = 60;
const MAX_N = 4;

export const OPTIONS = apiV1CorsPreflight;

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
  if (claim.kind === "replay") return jsonOk(claim.body, claim.status);
  if (claim.kind === "in_progress") throw inProgressError();

  try {
    const prompt = (body.prompt || "").trim();
    const n = Math.min(Math.max(Math.floor(body.n || 1) || 1, 1), MAX_N);
    const size = body.size || "1024x1024";
    const model = body.model;
    if (!prompt) throw new ApiError("prompt 为必填项", 400);

    const results = [];
    for (let i = 0; i < n; i++) {
      const r = await generateImage({
        userId: user.userId,
        role: user.role,
        prompt,
        size,
        modelOverride: model,
        idempotencyKey: `${claim.key}:${i}`,
      });
      results.push(r);
    }

    if (user.apiKeyId) {
      const consumedCredits = user.role === "admin" ? 0 : results.length * CREDIT_PER_IMAGE;
      await recordApiKeyUsage(user.apiKeyId, consumedCredits).catch((error) => {
        console.error("Failed to record API key usage", error);
      });
    }

    const origin = assertCanonicalPublicOrigin(process.env.PUBLIC_APP_URL);
    const responseBody = {
      created: Math.floor(Date.now() / 1000),
      data: results.map((r) => {
        if (!r.storageKey) return { url: `${origin}${r.imageUrl}` };
        const token = createImageAccessToken(r.storageKey, user.userId);
        return {
          url: `${origin}${r.imageUrl}?user=${encodeURIComponent(user.userId)}&token=${encodeURIComponent(token)}`,
        };
      }),
    };
    await completeRequest(claim.id, 200, responseBody);
    return jsonOk(responseBody);
  } catch (error) {
    await failRequest(claim.id, error instanceof ApiError ? error.status : 500, requestErrorBody(error)).catch(
      (recordError) => console.error("Failed to persist v1 image request failure", recordError),
    );
    throw error;
  }
});
