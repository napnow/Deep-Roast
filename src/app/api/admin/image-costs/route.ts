import { requireAdmin } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  getAdminImageModelCosts,
  updateAdminImageModelCosts,
} from "@/server/services/image-costs-api";

// GET /api/admin/image-costs — 当前启用的生图模型及其每张费用
export const GET = handleRoute(async (req) => {
  await requireAdmin(req);
  return jsonOk(await getAdminImageModelCosts());
});

// PUT /api/admin/image-costs — 仅更新提交的费用，不删除历史配置
export const PUT = handleRoute(async (req) => {
  await requireAdmin(req);
  const body = await readJson<{ imageModelCosts?: unknown }>(req);
  return jsonOk(await updateAdminImageModelCosts(body.imageModelCosts));
});
