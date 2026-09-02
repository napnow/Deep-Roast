import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { requestIdempotency } from "@/db/schema";
import { ApiError } from "@/server/http";
import { normalizeIdempotencyKey } from "./request-idempotency";

const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const COMPLETED_RETENTION_MS = 24 * 60 * 60 * 1000;

export type RequestReplay = {
  kind: "replay";
  status: number;
  body: Record<string, unknown>;
};

export type RequestClaim =
  | { kind: "new"; id: string; key: string }
  | RequestReplay
  | { kind: "in_progress" };

export async function beginRequest(
  userId: string,
  scope: string,
  rawKey: unknown,
): Promise<RequestClaim> {
  const key = normalizeIdempotencyKey(rawKey);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROCESSING_TIMEOUT_MS);

  const [inserted] = await db
    .insert(requestIdempotency)
    .values({
      userId,
      scope,
      key,
      status: "processing",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [
        requestIdempotency.userId,
        requestIdempotency.scope,
        requestIdempotency.key,
      ],
    })
    .returning({ id: requestIdempotency.id });

  if (inserted) return { kind: "new", id: inserted.id, key };

  const [existing] = await db
    .select({
      id: requestIdempotency.id,
      status: requestIdempotency.status,
      responseStatus: requestIdempotency.responseStatus,
      responseBody: requestIdempotency.responseBody,
      expiresAt: requestIdempotency.expiresAt,
    })
    .from(requestIdempotency)
    .where(
      and(
        eq(requestIdempotency.userId, userId),
        eq(requestIdempotency.scope, scope),
        eq(requestIdempotency.key, key),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new ApiError("幂等请求状态不存在，请稍后重试", 409, "IDEMPOTENCY_CONFLICT");
  }

  if (
    (existing.status === "succeeded" || existing.status === "failed") &&
    existing.responseStatus &&
    existing.responseBody
  ) {
    return {
      kind: "replay",
      status: existing.responseStatus,
      body: existing.responseBody,
    };
  }

  if (existing.status === "processing" && existing.expiresAt <= now) {
    const [claimed] = await db
      .update(requestIdempotency)
      .set({
        status: "processing",
        responseStatus: null,
        responseBody: null,
        updatedAt: now,
        expiresAt,
      })
      .where(
        and(
          eq(requestIdempotency.id, existing.id),
          eq(requestIdempotency.status, "processing"),
          lte(requestIdempotency.expiresAt, now),
        ),
      )
      .returning({ id: requestIdempotency.id });
    if (claimed) return { kind: "new", id: claimed.id, key };
  }

  return { kind: "in_progress" };
}

export async function completeRequest(
  id: string,
  status: number,
  body: Record<string, unknown>,
): Promise<void> {
  await db
    .update(requestIdempotency)
    .set({
      status: "succeeded",
      responseStatus: status,
      responseBody: body,
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + COMPLETED_RETENTION_MS),
    })
    .where(
      and(
        eq(requestIdempotency.id, id),
        eq(requestIdempotency.status, "processing"),
      ),
    );
}

export async function failRequest(
  id: string,
  status: number,
  body: Record<string, unknown>,
): Promise<void> {
  await db
    .update(requestIdempotency)
    .set({
      status: "failed",
      responseStatus: status,
      responseBody: body,
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + COMPLETED_RETENTION_MS),
    })
    .where(
      and(
        eq(requestIdempotency.id, id),
        eq(requestIdempotency.status, "processing"),
      ),
    );
}

export function inProgressError(): ApiError {
  return new ApiError(
    "相同幂等请求正在处理中，请稍后重试",
    409,
    "IDEMPOTENCY_IN_PROGRESS",
  );
}

export function requestErrorBody(error: unknown): Record<string, unknown> {
  if (error instanceof ApiError) {
    return { error: error.message, ...(error.code ? { code: error.code } : {}) };
  }
  return { error: "服务器错误" };
}
