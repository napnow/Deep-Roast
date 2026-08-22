import assert from "node:assert/strict";
import { test } from "node:test";
import { createInviteCode } from "./invitation-code";

test("creates an 8-character URL-safe invite code", () => {
  const code = createInviteCode();
  assert.equal(code.length, 8);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
});
