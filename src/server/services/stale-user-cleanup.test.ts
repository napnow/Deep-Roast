import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRegistrationRiskMarks } from "./stale-user-cleanup";

const now = new Date("2026-11-03T00:00:00.000Z");

test("builds risk marks for valid registration IPs", () => {
  const marks = buildRegistrationRiskMarks(
    [
      { ip: "203.0.113.24", username: "stale-user" },
      { ip: "unknown", username: "unknown-ip" },
      { ip: "not-an-ip", username: "invalid-ip" },
    ],
    { enabled: true, windowDays: 30 },
    now,
    "risk-secret",
  );

  assert.equal(marks.length, 1);
  assert.match(marks[0].ipHash, /^[a-f0-9]{64}$/);
  assert.equal(marks[0].lastUsername, "stale-user");
  assert.equal(
    marks[0].restrictedUntil.toISOString(),
    "2026-12-03T00:00:00.000Z",
  );
});

test("does not build risk marks when the policy is disabled", () => {
  assert.deepEqual(
    buildRegistrationRiskMarks(
      [{ ip: "203.0.113.24", username: "stale-user" }],
      { enabled: false, windowDays: 30 },
      now,
      "risk-secret",
    ),
    [],
  );
});

test("deduplicates equivalent IPs within one cleanup batch", () => {
  const marks = buildRegistrationRiskMarks(
    [
      { ip: "2001:0db8::1", username: "first" },
      { ip: "2001:0DB8::1", username: "second" },
    ],
    { enabled: true, windowDays: 7 },
    now,
    "risk-secret",
  );

  assert.equal(marks.length, 1);
  assert.equal(marks[0].lastUsername, "second");
});
