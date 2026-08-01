import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";

// ── Types ──
export interface AuthPayload {
  userId: string;
  username: string;
  role: string;
}

const DEV_FALLBACK_SECRET = "doubao-dev-secret-change-me";

// ── Secret ──
function getSecret(): Uint8Array {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) {
    return new TextEncoder().encode(fromEnv);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is required in production. Set it in the environment (see .env.example).",
    );
  }

  // 仅开发：可启动，但每次进程应意识到这是不安全默认
  if (!(globalThis as { __drJwtDevWarned?: boolean }).__drJwtDevWarned) {
    console.warn(
      "[auth] JWT_SECRET unset — using insecure dev fallback. Set JWT_SECRET before any real deploy.",
    );
    (globalThis as { __drJwtDevWarned?: boolean }).__drJwtDevWarned = true;
  }
  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

// ── Token helpers ──
export async function signToken(payload: AuthPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AuthPayload;
  } catch {
    return null;
  }
}

// ── Cookie helpers ──

/**
 * 判断当前请求是否为 HTTPS（或反向代理终止的 HTTPS）。
 * 生产环境下只有 HTTPS 才允许 secure cookie；若用 HTTP 访问（如局域网 IP），
 * 浏览器会直接丢弃 secure cookie，导致登录"成功"但状态刷不出来。
 */
async function isSecureRequest(): Promise<boolean> {
  // X-Forwarded-Proto：反代（nginx 等）终止 TLS 时常用的标准头
  const h = await headers();
  const fwdProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (fwdProto) return fwdProto === "https";

  // 无反代时，Next 自身只会在有 TLS 证书时才用 https
  // 开发环境 dev server 永远是 http
  if (process.env.NODE_ENV !== "production") return false;

  // 生产环境：没有反代头时，保守地按 Host 判断。localhost / 局域网 IP
  // 走的几乎都是 http，只有带 https 域名访问才需要 secure。
  const host = h.get("host") || "";
  // 简单启发式：含端口的局域网地址 → http
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3})/.test(host)) return false;
  return true;
}

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  const secure = await isSecureRequest();
  store.set("token", token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  const secure = await isSecureRequest();
  store.set("token", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// ── Password helpers ──
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
