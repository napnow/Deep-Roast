import assert from "node:assert/strict";
import { test } from "node:test";
import { isRegistrationIpLimitEnabled } from "./registration-policy";

test("defaults a missing setting to enabled and respects an explicit zero", () => {
  assert.equal(isRegistrationIpLimitEnabled(1), true);
  assert.equal(isRegistrationIpLimitEnabled(0), false);
  assert.equal(isRegistrationIpLimitEnabled(undefined), true);
  assert.equal(isRegistrationIpLimitEnabled(null), true);
});
