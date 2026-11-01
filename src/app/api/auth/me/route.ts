import { clearAuthCookie } from "@/lib/auth";
import { resolveUserFromRequest } from "@/server/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkinStatusFromUser } from "@/server/services/credits";
import { getCheckinReward } from "@/server/services/site-settings";

export async function GET(req: Request) {
  try {
    const payload = await resolveUserFromRequest(req);
    if (!payload) {
      return Response.json({ error: "登录已过期" }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        credits: users.credits,
        status: users.status,
        lastCheckinOn: users.lastCheckinOn,
      })
      .from(users)
      .where(eq(users.id, payload.userId as string));

    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 401 });
    }

    if (user.status === "banned") {
      await clearAuthCookie();
      return Response.json(
        { error: "账号已被封禁，请联系管理员" },
        { status: 403 },
      );
    }

    const checkin = checkinStatusFromUser(user, await getCheckinReward());

    return Response.json({
      id: user.id,
      username: user.username,
      role: user.role,
      credits: user.credits,
      status: user.status,
      checkin,
    });
  } catch {
    return Response.json({ error: "获取用户信息失败" }, { status: 500 });
  }
}
