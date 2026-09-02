import { randomUUID } from "node:crypto";
import { ApiError } from "@/server/http";

export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

export function normalizeIdempotencyKey(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError("缺少有效的幂等请求 ID", 400, "IDEMPOTENCY_KEY_REQUIRED");
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new ApiError("幂等请求 ID 无效", 400, "INVALID_IDEMPOTENCY_KEY");
  }
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new ApiError("幂等请求 ID 无效", 400, "INVALID_IDEMPOTENCY_KEY");
  }
  return normalized;
}

export function providerIdempotencyKey(
  scope: string,
  key: string,
  attempt = 1,
): string {
  return "deeproast:" + scope + ":" + key + ":" + String(attempt);
}

export function readIdempotencyKey(req: Request): string {
  const raw = req.headers.get("idempotency-key");
  return raw ? normalizeIdempotencyKey(raw) : randomUUID();
}
