import { db } from "@/db";
import { users, creditTransactions } from "@/db/schema";
import { eq, desc, sql, and, type SQL } from "drizzle-orm";
import { RECHARGE_PLANS, CREDIT_PER_IMAGE } from "@/types";
import { ApiError } from "@/server/http";

export async function getUserCredits(userId: string): Promise<number> {
  const [user] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new ApiError("用户不存在", 404);
  return user.credits;
}

export async function assertEnoughCredits(
  userId: string,
  cost = CREDIT_PER_IMAGE,
): Promise<void> {
  const credits = await getUserCredits(userId);
  if (credits < cost) {
    throw new ApiError("积分不足，请充值", 402, "INSUFFICIENT_CREDITS");
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

export async function rechargeCredits(userId: string, planId: string) {
  const plan = RECHARGE_PLANS.find((p) => p.planId === planId);
  if (!plan) throw new ApiError("无效的充值档位", 400);

  const [user] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new ApiError("用户不存在", 404);

  const newBalance = user.credits + plan.credits;
  await db
    .update(users)
    .set({ credits: newBalance, updatedAt: new Date() })
    .where(eq(users.id, userId));

  const [tx] = await db
    .insert(creditTransactions)
    .values({
      userId,
      type: "recharge",
      amount: plan.credits,
      balanceAfter: newBalance,
      planId: plan.planId,
      note: `¥${plan.amount}`,
    })
    .returning();

  return { balance: newBalance, transaction: tx };
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
      totalRechargeAmount: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'recharge' THEN ${creditTransactions.amount} ELSE 0 END), 0)::int`,
      totalConsumeAmount: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'consume' THEN ABS(${creditTransactions.amount}) ELSE 0 END), 0)::int`,
      totalSignupBonus: sql<number>`COALESCE(SUM(CASE WHEN ${creditTransactions.type} = 'signup_bonus' THEN ${creditTransactions.amount} ELSE 0 END), 0)::int`,
    })
    .from(creditTransactions);

  return { transactions: rows, stats };
}
