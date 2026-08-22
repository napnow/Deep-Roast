import { clearAuthCookie } from "@/lib/auth";

export async function POST() {
  try {
    await clearAuthCookie();
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "退出失败" }, { status: 500 });
  }
}
