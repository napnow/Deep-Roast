import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldEnforceRegistrationIpLimit } from "./registration-ip-limit";

test("enforces the policy only when enabled in production", () => {
  assert.equal(
    shouldEnforceRegistrationIpLimit("203.0.113.8", true, "production", []),
    true,
  );
  assert.equal(
    shouldEnforceRegistrationIpLimit("203.0.113.8", false, "production", []),
    false,
  );
  assert.equal(
    shouldEnforceRegistrationIpLimit(
      "203.0.113.8",
      true,
      "production",
      ["203.0.113.8"],
    ),
    false,
  );
  assert.equal(
    shouldEnforceRegistrationIpLimit("203.0.113.8", true, "development", []),
    false,
  );
});
