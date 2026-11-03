/**
 * 开发环境回退密钥。与 lib/auth.ts 共用，保证本地会话签名和风控哈希
 * 在进程重启后仍然稳定；生产环境必须显式配置 JWT_SECRET。
 */
const DEV_FALLBACK_SECRET = "doubao-dev-secret-change-me";

/**
 * 解析 JWT 密钥字符串：优先环境变量，生产缺失时抛错，非生产回退开发密钥。
 */
export function resolveJwtSecretString(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;

  if (env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is required in production. Set it in the environment (see .env.example).",
    );
  }

  return DEV_FALLBACK_SECRET;
}

/** 非生产环境是否正在使用不安全的回退密钥 */
export function usesDevFallbackSecret(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !env.JWT_SECRET?.trim() && env.NODE_ENV !== "production";
}
