import { db } from "@/db";
import { users, creditTransactions } from "@/db/schema";
import { eq, desc, sql, and, type SQL } from "drizzle-orm";
import { CREDIT_PER_IMAGE, CHECKIN_REWARD } from "@/types";
import { ApiError } from "@/server/http";
import { shanghaiToday } from "@/lib/shanghai-date";

export async function getUserCredits(userId: string): Promise<number> {
  const [user] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new ApiError("用户不存在", 404);
  return user.credits;
}

export async function getUserRow(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new ApiError("用户不存在", 404);
  return user;
}

export async function assertEnoughCredits(
  userId: string,
  cost = CREDIT_PER_IMAGE,
): Promise<void> {
  const credits = await getUserCredits(userId);
  if (credits < cost) {
    throw new ApiError(
      "积分不足，请先签到或联系管理员",
      402,
      "INSUFFICIENT_CREDITS",
    );
  }
}

export async function consumeCredits(
  userId: string,
  amount: number,
  note: string,
): Promise<number> {
  const [user] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new ApiError("用户不存在", 404);

  const newBalance = user.credits - amount;
  await db
    .update(users)
    .set({ credits: newBalance, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await db.insert(creditTransactions).values({
    userId,
    type: "consume",
    amount: -amount,
    balanceAfter: newBalance,
    note,
  });
  return newBalance;
}

/** 每日签到：仅普通用户，Asia/Shanghai 自然日一次 +CHECKIN_REWARD */
export async function performCheckin(userId: string) {
  const user = await getUserRow(userId);

  if (user.status === "banned") {
    throw new ApiError("账号已被封禁", 403);
  }
  if (user.role !== "user") {
    throw new ApiError("管理员无需签到", 403);
  }

  const today = shanghaiToday();
  if (user.lastCheckinOn === today) {
    throw new ApiError("今日已签到", 409);
  }

  const newBalance = user.credits + CHECKIN_REWARD;
  await db
    .update(users)
    .set({
      credits: newBalance,
      lastCheckinOn: today,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await db.insert(creditTransactions).values({
    userId,
    type: "checkin",
    amount: CHECKIN_REWARD,
    balanceAfter: newBalance,
    note: `每日签到 ${today}`,
  });

  return {
    credits: newBalance,
    checkinOn: today,
    reward: CHECKIN_REWARD,
    todayChecked: true,
  };
}

export function checkinStatusFromUser(user: {
  role: string;
  lastCheckinOn: string | null;
}) {
  const today = shanghaiToday();
  const isUser = user.role === "user";
  return {
    eligible: isUser,
    todayChecked: isUser && user.lastCheckinOn === today,
    checkinOn: user.lastCheckinOn,
    reward: CHECKIN_REWARD,
    today,
  };
}

export async function adjustCredits(
  userId: string,
  amount: number,
  note?: string,
) {
  if (!amount || amount === 0) throw new ApiError("参数不完整", 400);

  const type = amount > 0 ? "admin_grant" : "admin_deduct";
  const [user] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new ApiError("用户不存在", 404);

  const newBalance = user.credits + amount;
  if (newBalance < 0) throw new ApiError("积分不足，无法扣减", 400);

  await db
    .update(users)
    .set({ credits: newBalance, updatedAt: new Date() })
    .where(eq(users.id, userId));

  const [tx] = await db
    .insert(creditTransactions)
    .values({
      userId,
      type,
      amount,
      balanceAfter: newBalance,
      note: note || "",
    })
    .returning();

  return { balance: newBalance, transaction: tx };
}

export async function listUserTransactions(userId: string, limit = 50) {
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}

export async function listAdminTransactions(opts: {
  userId?: string | null;
  type?: string | null;
}) {
  const conditions: SQL[] = [];
  if (opts.userId) conditions.push(eq(creditTransactions.userId, opts.userId));
  if (opts.type && opts.type !== "all") {
    conditions.push(eq(creditTransactions.type, opts.type));
  }

  const rows = await db
    .select({
      id: creditTransactions.id,
      userId: creditTransactions.userId,
      username: users.username,
      type: creditTransactions.type,
      amount: creditTransactions.amount,
      balanceAfter: creditTransactions.balanceAfter,
      planId: creditTransactions.planId,
      note: creditTransactions.note,
      createdAt: creditTransactions.createdAt,
    })
    .from(creditTransactions)
    .leftJoin(users, eq(creditTransactions.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(creditTransactions.createdAt))
    .limit(200);

  const [stats] = await db
    .select({
      totalCheckinAmount: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'checkin' THEN ${creditTransactions.amount} ELSE 0 END), 0)::int`,
      totalConsumeAmount: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'consume' THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)::int`,
      totalSignupBonus: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'signup_bonus' THEN ${creditTransactions.amount} ELSE 0 END), 0)::int`,
      totalAdminGrant: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'admin_grant' THEN ${creditTransactions.amount} ELSE 0 END), 0)::int`,
      // 兼容旧字段名（仪表盘迁移期）
      totalRechargeAmount: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} IN ('checkin', 'recharge') THEN ${creditTransactions.amount} ELSE 0 END), 0)::int`,
    })
    .from(creditTransactions);

  return { transactions: rows, stats };
}
