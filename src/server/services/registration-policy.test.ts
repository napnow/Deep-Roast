import assert from "node:assert/strict";
import { test } from "node:test";
import { isRegistrationIpLimitEnabled } from "./registration-policy";

test("keeps the registration IP limit enabled when the setting is missing", () => {
  assert.equal(isRegistrationIpLimitEnabled(undefined), true);
});

test("disables the registration IP limit only for an explicit false value", () => {
  assert.equal(isRegistrationIpLimitEnabled("false"), false);
  assert.equal(isRegistrationIpLimitEnabled(" FALSE "), false);
  assert.equal(isRegistrationIpLimitEnabled("0"), true);
  assert.equal(isRegistrationIpLimitEnabled("off"), true);
});

test("keeps the registration IP limit enabled for true values", () => {
  assert.equal(isRegistrationIpLimitEnabled("true"), true);
  assert.equal(isRegistrationIpLimitEnabled(""), true);
});
