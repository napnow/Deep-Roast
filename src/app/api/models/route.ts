import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { fetchModelCatalog } from "@/server/services/models";
import { requireActiveUser } from "@/server/auth";

/**
 * GET /api/models
 * 使用已保存配置 / env 拉取目录（兼容旧调用）。
 *
 * POST /api/models
 * body: { baseUrl?: string; apiKey?: string }
 * 使用设置页「当前输入」的 Base URL + Key 拉取（未保存也可测）。
 */
export const GET = handleRoute(async (req) => {
  await requireActiveUser(req);
  return jsonOk(await fetchModelCatalog());
});

export const POST = handleRoute(async (req) => {
  await requireActiveUser(req);
  const body = await readJson<{ baseUrl?: string; apiKey?: string }>(req);
  if (body.baseUrl !== undefined && !String(body.baseUrl).trim()) {
    throw new ApiError("API Base URL 不能为空", 400);
  }
  return jsonOk(
    await fetchModelCatalog({
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
    }),
  );
});
