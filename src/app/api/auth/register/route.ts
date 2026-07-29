import { db } from "@/db";
import { users, creditTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/server/services/auth-password";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    if (username.length < 2 || username.length > 32) {
      return Response.json({ error: "用户名需要 2-32 个字符" }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return Response.json(
        { error: `密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符` },
        { status: 400 },
      );
    }

    // Check if username already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    if (existing.length > 0) {
      return Response.json({ error: "用户名已存在" }, { status: 409 });
    }

    const hashed = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({ username, password: hashed })
      .returning();

    // 注册赠送积分流水
    await db.insert(creditTransactions).values({
      userId: user.id,
      type: "signup_bonus",
      amount: 100,
      balanceAfter: 100,
      note: "新用户注册赠送",
    });

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });
    await setAuthCookie(token);

    return Response.json({ success: true, username: user.username, role: user.role }, { status: 201 });
  } catch {
    return Response.json({ error: "注册失败，请重试" }, { status: 500 });
  }
}
