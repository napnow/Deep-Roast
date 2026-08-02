import { requireActiveAdmin } from "@/server/auth";
import { ApiError, handleRoute, jsonOk } from "@/server/http";
import { saveAdminContactImage } from "@/server/services/site-settings";

export const POST = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    throw new ApiError("请选择图片文件（字段名 file）", 400);
  }
  const mime = file.type || "";
  const buf = Buffer.from(await file.arrayBuffer());
  return jsonOk(await saveAdminContactImage(buf, mime));
});
