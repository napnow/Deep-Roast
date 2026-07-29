import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

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
export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
