import { requireActiveAdmin } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import {
  createAnnouncement,
  listAnnouncements,
} from "@/server/services/announcements";
import { ANNOUNCEMENT_IMAGE_MAX_BYTES } from "@/server/services/announcement-image";

export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  return jsonOk({ announcements: await listAnnouncements(50) });
});

export const POST = handleRoute(async (req) => {
  const admin = await requireActiveAdmin(req);
  if ((req.headers.get("content-type") || "").includes("application/json")) {
    const body = await readJson<{ body?: string }>(req);
    return jsonOk(await createAnnouncement(body.body || "", admin.userId));
  }
  const form = await req.formData();
  const body = form.get("body");
  const image = form.get("image");
  if (body !== null && typeof body !== "string") {
    throw new ApiError("公告内容格式不正确", 400);
  }
  if (image !== null && !(image instanceof File)) {
    throw new ApiError("二维码图片格式不正确", 400);
  }
  if (image && image.size > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
    throw new ApiError("二维码图片不能超过 2MB", 400);
  }
  const imageData = image
    ? { data: Buffer.from(await image.arrayBuffer()), mime: image.type || "" }
    : null;
  return jsonOk(
    await createAnnouncement(body || "", admin.userId, imageData),
  );
});
