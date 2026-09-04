import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { ApiError } from "@/server/http";
import {
  removeAnnouncementImage,
  saveAnnouncementImage,
} from "@/server/services/announcement-image";

const MAX_BODY = 2000;
const LIST_LIMIT = 20;

export async function listAnnouncements(limit = LIST_LIMIT) {
  const rows = await db
    .select({
      id: announcements.id,
      body: announcements.body,
      imagePath: announcements.imagePath,
      pinned: announcements.pinned,
      createdAt: announcements.createdAt,
      createdBy: announcements.createdBy,
    })
    .from(announcements)
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    imageUrl: r.imagePath,
    pinned: r.pinned ?? false,
    createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    createdBy: r.createdBy,
  }));
}

export async function createAnnouncement(
  body: string,
  createdBy: string,
  image?: { data: Buffer; mime: string } | null,
) {
  const text = body.trim();
  if (!text) throw new ApiError("公告内容不能为空", 400);
  if (text.length > MAX_BODY) {
    throw new ApiError(`公告不能超过 ${MAX_BODY} 字`, 400);
  }

  const imagePath = image
    ? await saveAnnouncementImage(image.data, image.mime)
    : null;

  let row: typeof announcements.$inferSelect | undefined;
  try {
    [row] = await db
      .insert(announcements)
      .values({ body: text, imagePath, createdBy })
      .returning();
  } catch (error) {
    await removeAnnouncementImage(imagePath);
    throw error;
  }

  return {
    id: row!.id,
    body: row!.body,
    imageUrl: row!.imagePath,
    pinned: row!.pinned ?? false,
    createdAt: row!.createdAt?.toISOString?.() ?? String(row!.createdAt),
    createdBy: row!.createdBy,
  };
}

export async function togglePinAnnouncement(id: string) {
  const [row] = await db
    .update(announcements)
    .set({ pinned: sql`NOT COALESCE(${announcements.pinned}, false)` })
    .where(eq(announcements.id, id))
    .returning({ id: announcements.id, pinned: announcements.pinned });
  if (!row) throw new ApiError("公告不存在", 404);
  return { id: row.id, pinned: row.pinned ?? false };
}

export async function deleteAnnouncement(id: string) {
  const [row] = await db
    .delete(announcements)
    .where(eq(announcements.id, id))
    .returning({ id: announcements.id, imagePath: announcements.imagePath });
  if (!row) throw new ApiError("公告不存在", 404);
  await removeAnnouncementImage(row.imagePath);
  return { success: true };
}
