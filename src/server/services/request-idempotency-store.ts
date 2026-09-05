import { and, eq, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { requestIdempotency } from "@/db/schema";
import { ApiError } from "@/server/http";
import { normalizeIdempotencyKey } from "./request-idempotency";

// Covers the longest supported batch (five sequential image edits with
// bounded retries). Expired claims are failed, never reclaimed, so an old
// worker and a replacement can never execute the same key concurrently.
const PROCESSING_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const COMPLETED_RETENTION_MS = 24 * 60 * 60 * 1000;

export type RequestReplay = {
  kind: "replay";
  status: number;
  body: Record<string, unknown>;
};

export type RequestClaim =
  | { kind: "new"; id: string; key: string; leaseToken: string }
  | RequestReplay
  | { kind: "in_progress" };

type TransactionCallback = Parameters<typeof db.transaction>[0];
export type IdempotencyTransaction = Parameters<TransactionCallback>[0];

export async function beginRequest(
  userId: string,
  scope: string,
  rawKey: unknown,
): Promise<RequestClaim> {
  const key = normalizeIdempotencyKey(rawKey);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PROCESSING_TIMEOUT_MS);
  const leaseToken = randomUUID();

  const [inserted] = await db
    .insert(requestIdempotency)
    .values({
      userId,
      scope,
      key,
      leaseToken,
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

  if (inserted) return { kind: "new", id: inserted.id, key, leaseToken };

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
    const staleBody = {
      error: "先前的同 ID 请求已超时，请使用新的请求 ID 重试",
      code: "IDEMPOTENCY_STALE_REQUEST",
    };
    const [expired] = await db
      .update(requestIdempotency)
      .set({
        status: "failed",
        responseStatus: 409,
        responseBody: staleBody,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + COMPLETED_RETENTION_MS),
      })
      .where(
        and(
          eq(requestIdempotency.id, existing.id),
          eq(requestIdempotency.status, "processing"),
          lte(requestIdempotency.expiresAt, now),
        ),
      )
      .returning({ id: requestIdempotency.id });
    if (expired) return { kind: "replay", status: 409, body: staleBody };
  }

  return { kind: "in_progress" };
}

export async function completeRequest(
  id: string,
  leaseToken: string,
  status: number,
  body: Record<string, unknown>,
  tx?: IdempotencyTransaction,
): Promise<void> {
  const executor = tx ?? db;
  const [updated] = await executor
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
        eq(requestIdempotency.leaseToken, leaseToken),
        eq(requestIdempotency.status, "processing"),
      ),
    )
    .returning({ id: requestIdempotency.id });
  if (!updated) throw inProgressError();
}

export async function failRequest(
  id: string,
  leaseToken: string,
  status: number,
  body: Record<string, unknown>,
  tx?: IdempotencyTransaction,
): Promise<void> {
  const executor = tx ?? db;
  const [updated] = await executor
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
        eq(requestIdempotency.leaseToken, leaseToken),
        eq(requestIdempotency.status, "processing"),
      ),
    )
    .returning({ id: requestIdempotency.id });
  if (!updated) throw inProgressError();
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

export function requestErrorStatus(error: unknown): number {
  return error instanceof ApiError ? error.status : 500;
}
