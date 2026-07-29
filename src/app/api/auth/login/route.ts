import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { comparePassword, signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    const user = rows[0];
    if (!user) {
      return Response.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return Response.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    if (user.status === "banned") {
      return Response.json(
        { error: "账号已被封禁，请联系管理员" },
        { status: 403 },
      );
    }

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });
    await setAuthCookie(token);

    return Response.json({
      success: true,
      username: user.username,
      role: user.role,
    });
  } catch {
    return Response.json({ error: "登录失败，请重试" }, { status: 500 });
  }
}
