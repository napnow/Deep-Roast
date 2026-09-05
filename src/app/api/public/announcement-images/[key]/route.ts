import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { ApiError, handleRoute } from "@/server/http";
import {
  announcementImagePath,
  assertAnnouncementImageKey,
} from "@/server/services/announcement-image";

type Ctx = { params: Promise<{ key: string }> };

function contentType(key: string) {
  if (/\.jpe?g$/i.test(key)) return "image/jpeg";
  if (/\.webp$/i.test(key)) return "image/webp";
  return "image/png";
}

export const GET = handleRoute(async (_req, ctx: Ctx) => {
  const key = assertAnnouncementImageKey((await ctx.params).key);
  const expectedPath = `/api/public/announcement-images/${key}`;
  const [association] = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(eq(announcements.imagePath, expectedPath))
    .limit(1);
  if (!association) {
    throw new ApiError("公告图片不存在", 404, "ANNOUNCEMENT_IMAGE_NOT_FOUND");
  }
  let body: Buffer;
  try {
    body = await readFile(announcementImagePath(key));
  } catch {
    throw new ApiError("公告图片不存在", 404, "ANNOUNCEMENT_IMAGE_NOT_FOUND");
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType(key),
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
