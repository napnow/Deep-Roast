import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { comparePassword, signToken, setAuthCookie } from "@/lib/auth";
import { ApiError } from "@/server/http";
import {
  enforceRateLimit,
  getClientIp,
  assertAccountNotLocked,
  recordLoginFailure,
  clearLoginFailures,
} from "@/server/rate-limit";

// 登录限流：IP 20 次/分钟；单账号 10 次/分钟（防暴力破解）
const IP_LIMIT = 20;
const USER_LIMIT = 10;
const WINDOW = 60;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    await enforceRateLimit("login-ip", ip, IP_LIMIT, WINDOW);

    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    await enforceRateLimit("login-user", String(username), USER_LIMIT, WINDOW);

    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    const user = rows[0];
    if (!user) {
      // 用户不存在不计数（避免攻击者借机锁定任意账号）
      return Response.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    // 账号级锁定：分布式爆破的兜底防线（按账号，不受 IP 变化影响）
    await assertAccountNotLocked(user.username);

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      await recordLoginFailure(user.username);
      return Response.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    if (user.status === "banned") {
      return Response.json(
        { error: "账号已被封禁，请联系管理员" },
        { status: 403 },
      );
    }

    await clearLoginFailures(user.username);

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
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: err.headers },
      );
    }
    console.error("[login] 未预期错误:", err);
    return Response.json({ error: "登录失败，请重试" }, { status: 500 });
  }
}
