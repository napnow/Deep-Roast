import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getRegistrationRiskHashSecret,
  hashRegistrationIp,
  isRegistrationRestricted,
  normalizeClientIp,
  registrationRestrictionUntil,
} from "./registration-risk";

test("normalizes valid IPv4 and IPv6 client addresses", () => {
  assert.equal(normalizeClientIp(" 203.0.113.24 "), "203.0.113.24");
  assert.equal(normalizeClientIp("203.0.113.24:443"), "203.0.113.24");
  assert.equal(
    normalizeClientIp("[2001:0db8:0000:0000:0000:0000:0000:0001]"),
    "2001:db8::1",
  );
  assert.equal(normalizeClientIp("2001:0DB8::1"), "2001:db8::1");
});

test("rejects unknown and malformed client addresses", () => {
  assert.equal(normalizeClientIp(""), null);
  assert.equal(normalizeClientIp("unknown"), null);
  assert.equal(normalizeClientIp("203.0.113.999"), null);
  assert.equal(normalizeClientIp("not-an-ip"), null);
});

test("hashes normalized IPs with stable secret-bound output", () => {
  const first = hashRegistrationIp("203.0.113.24", "secret-a");
  const second = hashRegistrationIp("203.0.113.24", "secret-a");
  const different = hashRegistrationIp("203.0.113.24", "secret-b");

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, different);
});

test("calculates restriction expiry from the cleanup time", () => {
  const now = new Date("2026-11-03T00:00:00.000Z");
  assert.equal(
    registrationRestrictionUntil(now, 30).toISOString(),
    "2026-12-03T00:00:00.000Z",
  );
});

test("only active future restrictions count as restricted", () => {
  const now = new Date("2026-11-03T00:00:00.000Z");
  assert.equal(
    isRegistrationRestricted(new Date("2026-11-03T00:00:00.001Z"), now),
    true,
  );
  assert.equal(
    isRegistrationRestricted(new Date("2026-11-03T00:00:00.000Z"), now),
    false,
  );
  assert.equal(isRegistrationRestricted(null, now), false);
});

test("resolves the risk hash secret with a non-production fallback", () => {
  assert.equal(
    getRegistrationRiskHashSecret({
      NODE_ENV: "test",
      REGISTRATION_RISK_HASH_SECRET: "risk-secret",
      JWT_SECRET: "jwt-secret",
    }),
    "risk-secret",
  );
  assert.equal(
    getRegistrationRiskHashSecret({
      NODE_ENV: "test",
      JWT_SECRET: "jwt-secret",
    }),
    "jwt-secret",
  );

  const devFallback = getRegistrationRiskHashSecret({ NODE_ENV: "development" });
  assert.ok(devFallback.length > 0);
  assert.equal(
    devFallback,
    getRegistrationRiskHashSecret({ NODE_ENV: "development" }),
  );

  assert.throws(
    () => getRegistrationRiskHashSecret({ NODE_ENV: "production" }),
    /JWT_SECRET is required in production/,
  );
});
