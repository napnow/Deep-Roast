import assert from "node:assert/strict";
import { test } from "node:test";
import { isRegistrationIpLimitEnabled } from "./registration-policy";

test("treats only database value 1 as enabled", () => {
  assert.equal(isRegistrationIpLimitEnabled(1), true);
  assert.equal(isRegistrationIpLimitEnabled(0), false);
  assert.equal(isRegistrationIpLimitEnabled(undefined), false);
  assert.equal(isRegistrationIpLimitEnabled(null), false);
});
