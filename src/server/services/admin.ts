import { db } from "@/db";
import {
  users,
  conversations,
  imageGenerations,
  messages,
} from "@/db/schema";
import { desc, eq, asc, sql } from "drizzle-orm";

export async function listUsersWithStats() {
  const userRows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      credits: users.credits,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return Promise.all(
    userRows.map(async (user) => {
      const [convCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(sql`${conversations.userId} = ${user.id}`);

      const [imgCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(imageGenerations)
        .where(sql`${imageGenerations.userId} = ${user.id}`);

      const latestConvs = await db
        .select({ updatedAt: conversations.updatedAt })
        .from(conversations)
        .where(sql`${conversations.userId} = ${user.id}`)
        .orderBy(desc(conversations.updatedAt))
        .limit(1);

      const latestImages = await db
        .select({ createdAt: imageGenerations.createdAt })
        .from(imageGenerations)
        .where(sql`${imageGenerations.userId} = ${user.id}`)
        .orderBy(desc(imageGenerations.createdAt))
        .limit(1);

      let lastActive: string | null = null;
      const convTime = latestConvs[0]?.updatedAt;
      const imgTime = latestImages[0]?.createdAt;
      if (convTime || imgTime) {
        const a = convTime ? new Date(convTime).getTime() : 0;
        const b = imgTime ? new Date(imgTime).getTime() : 0;
        lastActive = new Date(Math.max(a, b)).toISOString();
      }

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        credits: user.credits,
        conversationCount: convCount?.count ?? 0,
        imageCount: imgCount?.count ?? 0,
        createdAt: user.createdAt,
        lastActive,
      };
    }),
  );
}

export async function listUserConversations(userId: string) {
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
    .orderBy(asc(conversations.updatedAt));
}

export async function listUserImages(userId: string) {
  return db
    .select()
    .from(imageGenerations)
    .where(eq(imageGenerations.userId, userId))
    .orderBy(asc(imageGenerations.createdAt))
    .limit(100);
}

export async function listConversationMessages(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}
