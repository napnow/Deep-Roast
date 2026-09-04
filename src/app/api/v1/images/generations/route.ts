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

// 中转限流：每个用户每分钟最多 10 次文生图请求（防刷带宽/上游额度）
const GATEWAY_LIMIT = 10;
const GATEWAY_WINDOW = 60;
// 单次请求最多生成张数（防恶意大 n 消耗）
const MAX_N = 4;

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

  const prompt = (body.prompt || "").trim();
  const n = Math.min(Math.max(Math.floor(body.n || 1) || 1, 1), MAX_N);
  const size = body.size || "1024x1024";
  const model = body.model;

  if (!prompt) throw new ApiError("prompt 为必填项", 400);

  // 逐张生成：generateImage 内部校验模型白名单 + 每张扣 5 积分
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = await generateImage({
      userId: user.userId,
      role: user.role,
      prompt,
      size,
      modelOverride: model,
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

  return jsonOk({
    created: Math.floor(Date.now() / 1000),
    data: results.map((r) => ({ url: `${origin}${r.imageUrl}` })),
  });
});
