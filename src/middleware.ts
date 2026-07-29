import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};

function getSecret(): Uint8Array {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return new TextEncoder().encode(fromEnv);
  if (process.env.NODE_ENV === "production") {
    // 与 src/lib/auth.ts 一致：生产禁止静默弱密钥
    throw new Error("JWT_SECRET is required in production");
  }
  return new TextEncoder().encode("doubao-dev-secret-change-me");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow auth routes to pass through
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Public read APIs (login page contact info, etc.)
  if (pathname.startsWith("/api/public/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Admin routes require admin role
    if (pathname.startsWith("/api/admin/") && payload.role !== "admin") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    // For /admin page route, redirect non-admin to home
    if (pathname.startsWith("/admin") && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Inject user info into request headers for API routes
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", payload.userId as string);
    requestHeaders.set("x-user-username", payload.username as string);
    requestHeaders.set("x-user-role", payload.role as string);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }
}
