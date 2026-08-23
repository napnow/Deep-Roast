import assert from "node:assert/strict";
import { test } from "node:test";
import { createCreditReservation } from "./credits";

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
