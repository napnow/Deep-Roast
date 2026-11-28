import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const testUrl = process.env.TEST_CANVAS_DATABASE_URL;

function assertIsolatedUrl(value: string): void {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname) ||
      !url.pathname.slice(1).startsWith("deeproast_canvas_test_") || url.search || url.hash) {
    throw new Error("TEST_CANVAS_DATABASE_URL must name a loopback deeproast_canvas_test_* database");
  }
}

test("request idempotency replays settled work and fences concurrent or stale claims", { skip: !testUrl }, async () => {
  assertIsolatedUrl(testUrl!);
  process.env.DATABASE_URL = testUrl;
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: testUrl });
  const userId = randomUUID();
  try {
    await pool.query(
      "INSERT INTO users(id,username,password,credits) VALUES ($1,$2,'not-a-real-login',10)",
      [userId, `idempotency-${userId}`],
    );
    const {
      beginRequest,
      completeRequest,
      failRequest,
      pruneExpiredRequests,
    } = await import("./request-idempotency-store");
    const { getUserCredits, reserveCredits } = await import("./credits");

    const concurrent = await Promise.all([
      beginRequest(userId, "integration", "concurrent-key"),
      beginRequest(userId, "integration", "concurrent-key"),
    ]);
    assert.equal(concurrent.filter(claim => claim.kind === "new").length, 1);
    assert.equal(concurrent.filter(claim => claim.kind === "in_progress").length, 1);
    const winner = concurrent.find(claim => claim.kind === "new");
    assert.ok(winner?.kind === "new");
    await completeRequest(winner.id, winner.leaseToken, 200, { imageId: "image-1" });
    assert.deepEqual(
      await beginRequest(userId, "integration", "concurrent-key"),
      { kind: "replay", status: 200, body: { imageId: "image-1" } },
    );

    const failed = await beginRequest(userId, "integration", "failed-key");
    assert.equal(failed.kind, "new");
    assert.ok(failed.kind === "new");
    await failRequest(failed.id, failed.leaseToken, 502, { error: "upstream failed" });
    assert.deepEqual(
      await beginRequest(userId, "integration", "failed-key"),
      { kind: "replay", status: 502, body: { error: "upstream failed" } },
    );

    await pool.query(
      `UPDATE request_idempotency SET expires_at=(now() AT TIME ZONE 'UTC')-interval '1 second'
       WHERE user_id=$1 AND scope='integration' AND key IN ('concurrent-key','failed-key')`,
      [userId],
    );
    const afterSuccessExpiry = await beginRequest(userId, "integration", "concurrent-key");
    assert.equal(afterSuccessExpiry.kind, "new");
    const afterFailedExpiry = await beginRequest(userId, "integration", "failed-key");
    assert.equal(afterFailedExpiry.kind, "new");

    const pruneClaim = await beginRequest(userId, "integration", "prune-key");
    assert.ok(pruneClaim.kind === "new");
    await completeRequest(pruneClaim.id, pruneClaim.leaseToken, 200, { ok: true });
    await pool.query(
      `UPDATE request_idempotency SET expires_at=(now() AT TIME ZONE 'UTC')-interval '1 second'
       WHERE user_id=$1 AND scope='integration' AND key='prune-key'`,
      [userId],
    );
    const prunedCount = await pruneExpiredRequests(new Date());
    assert.ok(prunedCount >= 1);

    const leased = await beginRequest(userId, "integration", "lease-key");
    assert.ok(leased.kind === "new");
    await assert.rejects(
      completeRequest(leased.id, randomUUID(), 200, { imageId: "wrong-lease" }),
      /正在处理中/,
    );

    const stale = await beginRequest(userId, "integration", "stale-key");
    assert.ok(stale.kind === "new");
    await reserveCredits(userId, 5, "预扣中断测试", { requestId: stale.id });
    assert.equal(await getUserCredits(userId), 5);
    await pool.query(
      `UPDATE request_idempotency SET expires_at=(now() AT TIME ZONE 'UTC')-interval '1 second'
       WHERE user_id=$1 AND scope='integration' AND key='stale-key'`,
      [userId],
    );
    assert.deepEqual(
      await beginRequest(userId, "integration", "stale-key"),
      {
        kind: "replay",
        status: 409,
        body: {
          error: "先前的同 ID 请求已超时，请使用新的请求 ID 重试",
          code: "IDEMPOTENCY_STALE_REQUEST",
        },
      },
    );
    assert.equal(await getUserCredits(userId), 10, "interrupted reservation must auto-refund on stale timeout");

    const settledBeforeCrash = await beginRequest(userId, "integration", "settled-before-crash");
    assert.ok(settledBeforeCrash.kind === "new");
    const settledReservation = await reserveCredits(userId, 4, "已出图预扣测试", {
      requestId: settledBeforeCrash.id,
    });
    await settledReservation.settle?.();
    assert.equal(await getUserCredits(userId), 6);
    await pool.query(
      `UPDATE request_idempotency SET expires_at=(now() AT TIME ZONE 'UTC')-interval '1 second'
       WHERE user_id=$1 AND scope='integration' AND key='settled-before-crash'`,
      [userId],
    );
    await beginRequest(userId, "integration", "settled-before-crash");
    assert.equal(await getUserCredits(userId), 6, "settled image reservation must not refund");
  } finally {
    await pool.query("DELETE FROM users WHERE id=$1", [userId]);
    await pool.end();
  }
});
