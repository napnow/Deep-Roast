import { verifyToken } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    // 直接从 cookie 读取 JWT，不依赖 middleware（middleware 对 /api/auth/* 放行不注入 header）
    const cookieHeader = req.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
      return Response.json({ error: "未登录" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return Response.json({ error: "登录已过期" }, { status: 401 });
    }

    // Query credits from DB
    let credits = 0;
    try {
      const [user] = await db
        .select({ credits: users.credits })
        .from(users)
        .where(eq(users.id, payload.userId as string));
      if (user) credits = user.credits;
    } catch {
      // Keep credits as 0 if DB query fails
    }

    return Response.json({ id: payload.userId, username: payload.username, role: payload.role, credits });
  } catch {
    return Response.json({ error: "获取用户信息失败" }, { status: 500 });
  }
}
