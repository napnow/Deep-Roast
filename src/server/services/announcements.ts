import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { ApiError } from "@/server/http";

const MAX_BODY = 2000;
const LIST_LIMIT = 20;

export async function listAnnouncements(limit = LIST_LIMIT) {
  const rows = await db
    .select({
      id: announcements.id,
      body: announcements.body,
      createdAt: announcements.createdAt,
      createdBy: announcements.createdBy,
    })
    .from(announcements)
    .orderBy(desc(announcements.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
    createdBy: r.createdBy,
  }));
}

export async function createAnnouncement(body: string, createdBy: string) {
  const text = body.trim();
  if (!text) throw new ApiError("公告内容不能为空", 400);
  if (text.length > MAX_BODY) {
    throw new ApiError(`公告不能超过 ${MAX_BODY} 字`, 400);
  }

  const [row] = await db
    .insert(announcements)
    .values({ body: text, createdBy })
    .returning();

  return {
    id: row!.id,
    body: row!.body,
    createdAt: row!.createdAt?.toISOString?.() ?? String(row!.createdAt),
    createdBy: row!.createdBy,
  };
}

export async function deleteAnnouncement(id: string) {
  const [row] = await db
    .delete(announcements)
    .where(eq(announcements.id, id))
    .returning({ id: announcements.id });
  if (!row) throw new ApiError("公告不存在", 404);
  return { success: true };
}
