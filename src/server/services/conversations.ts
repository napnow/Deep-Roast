import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getConfig } from "@/lib/config";
import { ApiError } from "@/server/http";
import { isConfiguredModelEnabled } from "@/server/services/model-channels";

async function assertConfiguredConversationModel(model: string) {
  const config = await getConfig();
  if (!(await isConfiguredModelEnabled(config || {}, "text", model))) {
    throw new ApiError("指定的模型不可用", 400);
  }
}

export async function listConversations(userId: string) {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      model: conversations.model,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
      messageCount: sql<number>`count(${messages.id})::int`,
    })
    .from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, userId))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.updatedAt));
}

export async function createConversation(
  userId: string,
  opts: { title?: string; model?: string } = {},
) {
  const title = opts.title?.trim() || "新对话";
  let model = opts.model?.trim();
  if (!model) {
    const config = await getConfig();
    model = config?.textModel || "doubao-seed-2-0-pro-260215";
  }
  await assertConfiguredConversationModel(model);
  const [conv] = await db
    .insert(conversations)
    .values({ title, model, userId })
    .returning();
  return conv;
}

export async function getConversationWithMessages(
  userId: string,
  id: string,
) {
  const convs = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  const conv = convs[0];
  if (!conv) throw new ApiError("对话不存在", 404);

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  return { conversation: conv, messages: msgs };
}

export async function updateConversation(
  userId: string,
  id: string,
  updates: { title?: string; model?: string },
) {
  const patch: { title?: string; model?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (updates.title !== undefined) {
    if (!updates.title.trim()) throw new ApiError("title 不能为空", 400);
    patch.title = updates.title.trim();
  }
  if (updates.model !== undefined) {
    if (!updates.model.trim()) throw new ApiError("model 不能为空", 400);
    patch.model = updates.model.trim();
    await assertConfiguredConversationModel(patch.model);
  }
  if (patch.title === undefined && patch.model === undefined) {
    throw new ApiError("没有需要更新的字段", 400);
  }

  const [updated] = await db
    .update(conversations)
    .set(patch)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();

  if (!updated) throw new ApiError("对话不存在", 404);
  return updated;
}

export async function deleteConversation(userId: string, id: string) {
  const convs = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  if (!convs[0]) throw new ApiError("对话不存在", 404);

  await db.delete(conversations).where(eq(conversations.id, id));
  return { success: true };
}
