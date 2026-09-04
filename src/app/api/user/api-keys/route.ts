import { requireActiveUser } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import {
  createApiKey,
  listApiKeys,
} from "@/server/services/api-keys";
import { enforceRateLimit } from "@/server/rate-limit";

// GET /api/user/api-keys — 我的 API Key 列表（脱敏）
export const GET = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  return jsonOk({ keys: await listApiKeys(user.userId) });
});

// POST /api/user/api-keys — 创建 key（明文仅返回一次）
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit("api-key-create", user.userId, 10, 60 * 60);
  const body = await readJson<{ name?: string }>(req);
  const result = await createApiKey(user.userId, body.name || "");
  return jsonOk(result, 200, { "Cache-Control": "private, no-store" });
});

// 未知方法兜底
export const DELETE = handleRoute(async () => {
  throw new ApiError("不支持", 405);
});
