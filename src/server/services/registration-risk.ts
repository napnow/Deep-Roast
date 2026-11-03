import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { resolveJwtSecretString } from "@/lib/auth-secret";

const IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;

export function normalizeClientIp(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.toLowerCase() === "unknown") return null;

  const ipv4WithPort = IPV4_WITH_PORT.exec(value);
  const candidate = (ipv4WithPort ? ipv4WithPort[1] : value).replace(
    /^\[|\]$/g,
    "",
  );

  if (isIP(candidate) === 4) return candidate;
  if (isIP(candidate) !== 6) return null;

  try {
    const hostname = new URL(`http://[${candidate}]/`).hostname;
    const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return isIP(normalized) === 6 ? normalized : null;
  } catch {
    return null;
  }
}

export function hashRegistrationIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function registrationRestrictionUntil(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isRegistrationRestricted(
  restrictedUntil: Date | null | undefined,
  now = new Date(),
): boolean {
  return restrictedUntil != null && restrictedUntil.getTime() > now.getTime();
}

export function getRegistrationRiskHashSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.REGISTRATION_RISK_HASH_SECRET?.trim();
  if (explicit) return explicit;

  // 与 JWT 会话密钥共用解析规则：生产必须有密钥，非生产回退开发密钥，
  // 避免本地环境缺少 JWT_SECRET 时注册和清理直接失败。
  return resolveJwtSecretString(env);
}
