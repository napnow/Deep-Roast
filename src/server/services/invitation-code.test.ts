import assert from "node:assert/strict";
import { test } from "node:test";
import { createInviteCode } from "./invitation-code";

test("creates a fixed-length URL-safe invite code", () => {
  const code = createInviteCode();
  assert.equal(code.length, 20);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
});
