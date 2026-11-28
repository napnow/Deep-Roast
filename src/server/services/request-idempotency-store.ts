import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { requestIdempotency } from "@/db/schema";
import { ApiError } from "@/server/http";
import { refundCredits } from "@/server/services/credits";
import { normalizeIdempotencyKey } from "./request-idempotency";

// Covers the longest supported batch (five sequential image edits with
// bounded retries). Expired claims are failed, never reclaimed, so an old
// worker and a replacement can never execute the same key concurrently.
const PROCESSING_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const COMPLETED_RETENTION_MS = 24 * 60 * 60 * 1000;
const PRUNE_BATCH_SIZE = 200;
const STALE_SWEEP_BATCH_SIZE = 50;
const PRUNE_INTERVAL_MS = 60_000;
const RESERVATION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let lastPruneAt = 0;

export interface PendingCreditReservationRecord {
  txId: string;
  amount: number;
}

export function parsePendingReservations(
  body: unknown,
): PendingCreditReservationRecord[] {
  if (!body || typeof body !== "object") return [];
  const rawList = (body as { pendingReservations?: unknown }).pendingReservations;
  if (!Array.isArray(rawList)) return [];
  const out: PendingCreditReservationRecord[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as {
      txId?: unknown;
      amount?: unknown;
      settled?: unknown;
    };
    if (candidate.settled === true) continue;
    if (
      typeof candidate.txId === "string" &&
      RESERVATION_UUID_RE.test(candidate.txId) &&
      typeof candidate.amount === "number" &&
      Number.isSafeInteger(candidate.amount) &&
      candidate.amount > 0
    ) {
      out.push({ txId: candidate.txId, amount: candidate.amount });
    }
  }
  return out;
}

async function expireStaleProcessingRow(
  existing: {
    id: string;
    userId: string;
    responseBody: Record<string, unknown> | null;
  },
  now: Date,
): Promise<{
  expired: boolean;
  body: { error: string; code: string };
}> {
  const pending = parsePendingReservations(existing.responseBody);
  for (const item of pending) {
    await refundCredits(
      existing.userId,
      item.amount,
      "超时中断任务自动退回预扣积分",
      item.txId,
    );
  }
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
  return { expired: Boolean(expired), body: staleBody };
}

export async function recoverStaleProcessingRequests(
  now = new Date(),
  limit = STALE_SWEEP_BATCH_SIZE,
): Promise<number> {
  const staleRows = await db
    .select({
      id: requestIdempotency.id,
      userId: requestIdempotency.userId,
      responseBody: requestIdempotency.responseBody,
    })
    .from(requestIdempotency)
    .where(
      and(
        eq(requestIdempotency.status, "processing"),
        lte(requestIdempotency.expiresAt, now),
      ),
    )
    .limit(limit);
  let count = 0;
  for (const row of staleRows) {
    const result = await expireStaleProcessingRow(row, now);
    if (result.expired) count += 1;
  }
  return count;
}

export async function pruneExpiredRequests(
  now = new Date(),
  limit = PRUNE_BATCH_SIZE,
): Promise<number> {
  await recoverStaleProcessingRequests(now);
  const expiredIds = db
    .select({ id: requestIdempotency.id })
    .from(requestIdempotency)
    .where(
      and(
        inArray(requestIdempotency.status, ["succeeded", "failed"]),
        lte(requestIdempotency.expiresAt, now),
      ),
    )
    .limit(limit);
  const deleted = await db
    .delete(requestIdempotency)
    .where(
      and(
        inArray(requestIdempotency.id, expiredIds),
        inArray(requestIdempotency.status, ["succeeded", "failed"]),
        lte(requestIdempotency.expiresAt, now),
      ),
    )
    .returning({ id: requestIdempotency.id });
  return deleted.length;
}

function scheduleExpiredRequestPrune(now = new Date()): void {
  const ts = now.getTime();
  if (ts - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = ts;
  void pruneExpiredRequests(now).catch(() => undefined);
}

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
    .onConflictDoUpdate({
      target: [
        requestIdempotency.userId,
        requestIdempotency.scope,
        requestIdempotency.key,
      ],
      set: {
        leaseToken,
        status: "processing",
        responseStatus: null,
        responseBody: null,
        updatedAt: now,
        expiresAt,
      },
      setWhere: and(
        inArray(requestIdempotency.status, ["succeeded", "failed"]),
        lte(requestIdempotency.expiresAt, now),
      ),
    })
    .returning({ id: requestIdempotency.id });

  if (inserted) return { kind: "new", id: inserted.id, key, leaseToken };

  const [existing] = await db
    .select({
      id: requestIdempotency.id,
      userId: requestIdempotency.userId,
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
    existing.expiresAt > now &&
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
    const { expired, body } = await expireStaleProcessingRow(existing, now);
    if (expired) return { kind: "replay", status: 409, body };
  }

  return { kind: "in_progress" };
}

export async function peekRequestClaim(
  userId: string,
  scope: string,
  rawKey: unknown,
): Promise<RequestReplay | { kind: "in_progress" } | null> {
  const key = normalizeIdempotencyKey(rawKey);
  const now = new Date();
  const [existing] = await db
    .select({
      id: requestIdempotency.id,
      userId: requestIdempotency.userId,
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

  if (!existing) return null;

  if (existing.status === "succeeded" || existing.status === "failed") {
    if (
      existing.expiresAt > now &&
      existing.responseStatus &&
      existing.responseBody
    ) {
      return {
        kind: "replay",
        status: existing.responseStatus,
        body: existing.responseBody,
      };
    }
    return null;
  }

  if (existing.status === "processing" && existing.expiresAt <= now) {
    const { expired, body } = await expireStaleProcessingRow(existing, now);
    if (expired) return { kind: "replay", status: 409, body };
  }

  return { kind: "in_progress" };
}

export async function releaseRequestClaim(
  id: string,
  leaseToken: string,
): Promise<void> {
  await db
    .delete(requestIdempotency)
    .where(
      and(
        eq(requestIdempotency.id, id),
        eq(requestIdempotency.leaseToken, leaseToken),
        eq(requestIdempotency.status, "processing"),
        isNull(requestIdempotency.responseBody),
      ),
    );
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
  if (!tx) scheduleExpiredRequestPrune();
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
  if (!tx) scheduleExpiredRequestPrune();
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
