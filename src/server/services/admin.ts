import { db } from "@/db";
import {
  users,
  conversations,
  imageGenerations,
  messages,
  registrationRecords,
} from "@/db/schema";
import { desc, eq, asc, sql } from "drizzle-orm";
import { unlink } from "fs/promises";
import path from "path";
import { ApiError } from "@/server/http";
import {
  privateImagePath,
  privateImageRoot,
  privateThumbnailPath,
  protectedLegacyImageUrl,
  protectedImageUrl,
  withImageOwner,
} from "@/server/services/private-images";

export async function listUsersWithStats() {
  const userRows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      credits: users.credits,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
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
      // 登录时间（users.updatedAt）也计入最近使用
      const loginTime = user.updatedAt;
      if (convTime || imgTime || loginTime) {
        const a = convTime ? new Date(String(convTime)).getTime() : 0;
        const b = imgTime ? new Date(String(imgTime)).getTime() : 0;
        const c = loginTime ? new Date(String(loginTime)).getTime() : 0;
        lastActive = new Date(Math.max(a, b, c)).toISOString();
      }

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        credits: user.credits,
        status: user.status ?? "active",
        conversationCount: convCount?.count ?? 0,
        imageCount: imgCount?.count ?? 0,
        createdAt: user.createdAt,
        lastActive,
      };
    }),
  ).then((rows) =>
    // 按最近使用排序（lastActive 为空 = 从未使用，按注册时间排最后）
    rows.sort((a, b) => {
      const ta = a.lastActive ? new Date(String(a.lastActive)).getTime() : 0;
      const tb = b.lastActive ? new Date(String(b.lastActive)).getTime() : 0;
      if (ta !== tb) return tb - ta;
      return (
        new Date(String(b.createdAt)).getTime() -
        new Date(String(a.createdAt)).getTime()
      );
    }),
  );
}

function assertNotAdminTarget(role: string) {
  if (role === "admin") {
    throw new ApiError("不能封禁或删除管理员账号", 403);
  }
}

export async function setUserStatus(
  userId: string,
  status: "active" | "banned",
) {
  if (status !== "active" && status !== "banned") {
    throw new ApiError("无效状态", 400);
  }
  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) throw new ApiError("用户不存在", 404);
  assertNotAdminTarget(target.role);

  const [row] = await db
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      role: users.role,
      status: users.status,
      credits: users.credits,
    });
  return row!;
}

export async function deleteUserHard(userId: string) {
  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) throw new ApiError("用户不存在", 404);
  assertNotAdminTarget(target.role);

  const images = await db
    .select({
      imageUrl: imageGenerations.imageUrl,
      storageKey: imageGenerations.storageKey,
    })
    .from(imageGenerations)
    .where(eq(imageGenerations.userId, userId));

  for (const img of images) {
    try {
        const imagePath = img.storageKey
          ? privateImagePath(privateImageRoot(), img.storageKey)
          : path.join(process.cwd(), "public", img.imageUrl.replace(/^\//, ""));
        await unlink(imagePath);
      } catch {
        /* best-effort */
      }
      if (img.storageKey) {
        try {
          await unlink(privateThumbnailPath(privateImageRoot(), img.storageKey));
        } catch {
          /* best-effort */
        }
      }
  }

  await db.delete(users).where(eq(users.id, userId));

  // 释放该用户占用的注册 IP 记录，使同一 IP 可以重新注册
  await db
    .delete(registrationRecords)
    .where(eq(registrationRecords.username, target.username))
    .catch(() => {});

  return { success: true };
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
    const rows = await db
      .select()
      .from(imageGenerations)
      .where(eq(imageGenerations.userId, userId))
      .orderBy(asc(imageGenerations.createdAt))
      .limit(100);
    return rows.map((row) => {
      if (row.storageKey) {
        return {
          ...row,
          imageUrl: withImageOwner(protectedImageUrl(row.storageKey), userId),
        };
      }
      const legacyKey = /^\/images\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp))$/i.exec(
        row.imageUrl,
      )?.[1];
      return legacyKey
        ? {
            ...row,
            imageUrl: withImageOwner(
              protectedLegacyImageUrl(legacyKey),
              userId,
            ),
          }
        : row;
    });
  }

export async function listConversationMessages(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}
