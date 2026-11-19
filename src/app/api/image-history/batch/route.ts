import { requireActiveUser } from "@/server/auth";
import { handleRoute, readJson, jsonOk, ApiError } from "@/server/http";
import { deleteImageRecords } from "@/server/services/image";

export const POST = handleRoute(async (req) => {
  const { userId } = await requireActiveUser(req);
  const body = await readJson<{ ids?: unknown }>(req);
  if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== "string")) {
    throw new ApiError("图片 ID 列表无效", 400, "INVALID_IMAGE_IDS");
  }
  if (body.ids.length > 100) throw new ApiError("一次最多删除 100 张图片", 400, "TOO_MANY_IMAGE_IDS");
  return jsonOk(await deleteImageRecords(userId, body.ids));
});
