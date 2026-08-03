import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// middleware 运行在 Edge Runtime，无法安全读取 JWT_SECRET
// （非 NEXT_PUBLIC_ 变量不会注入 edge bundle，注入又会泄露到浏览器）。
// 因此 API 鉴权全部下放到各 route 内部（Node Runtime，读取真实环境变量），
// middleware 只做 /admin 页面的登录重定向。
export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API 全部放行：鉴权由各 route 的 requireActiveUser / requireAdmin 完成
  // （Node Runtime 可读 JWT_SECRET，与 /api/auth/me 一致，避免 edge 密钥缺失导致 401）
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // /admin 页面：未登录重定向到登录页（仅体验引导，真正的权限在 /api/admin/* 内部校验）
  const token = req.cookies.get("token")?.value;
  if (pathname.startsWith("/admin") && !token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}
