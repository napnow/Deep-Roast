import { requireApiUser } from "@/server/auth";
import { apiV1CorsPreflight, handleRoute, jsonOk } from "@/server/http";
import { getConfig, defaultImageModelIds, parseEnabledModels } from "@/lib/config";

export const OPTIONS = apiV1CorsPreflight;

// GET /api/v1/models — 列出管理员启用的生图模型（中转可用模型）
export const GET = handleRoute(async (req) => {
  const user = await requireApiUser(req);
  const config = await getConfig();
  const enabled = parseEnabledModels(
    config?.enabledImageModels,
    defaultImageModelIds(),
    config?.imageModel,
  );
  return jsonOk({
    object: "list",
    data: enabled.map((id) => ({
      id,
      object: "model",
      created: 0,
      owned_by: "deep-roast",
    })),
  });
});
