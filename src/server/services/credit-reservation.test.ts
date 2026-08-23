import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ApiError } from "@/server/http";
import { assertCreditAmount, createCreditReservation } from "./credits";

test("credit reservation refunds at most once", async () => {
  let refunds = 0;
  const reservation = createCreditReservation(async () => {
    refunds += 1;
  });

  await Promise.all([
    reservation.refund("failed"),
    reservation.refund("failed"),
  ]);

  assert.equal(refunds, 1);
});

test("a failed refund may be retried", async () => {
  let calls = 0;
  const reservation = createCreditReservation(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary database error");
  });

  await assert.rejects(() => reservation.refund("failed"));
  await reservation.refund("failed");

  assert.equal(calls, 2);
});

test("credit amounts must be positive safe integers", () => {
  for (const amount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => assertCreditAmount(amount),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  }
  assert.doesNotThrow(() => assertCreditAmount(1));
  assert.doesNotThrow(() => assertCreditAmount(Number.MAX_SAFE_INTEGER));
});

test("credit schema has a unique reservation identity for durable refunds", () => {
  const schema = readFileSync("src/db/schema.ts", "utf8");
  assert.match(schema, /reservationId:\s*uuid\("reservation_id"\)/);
  assert.match(schema, /uniqueIndex\([^)]*reservation/i);
});
