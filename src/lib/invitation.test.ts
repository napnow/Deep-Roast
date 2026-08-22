import assert from "node:assert/strict";
import { test } from "node:test";
import { buildInviteLink, normalizeInviteCode } from "./invitation";

test("normalizes an invite code and rejects blank input", () => {
  assert.equal(normalizeInviteCode("  AbC_123  "), "AbC_123");
  assert.equal(normalizeInviteCode("   "), null);
  assert.equal(normalizeInviteCode(undefined), null);
});

test("builds an encoded login invite link", () => {
  assert.equal(
    buildInviteLink("https://deeproast.example", "abc/def"),
    "https://deeproast.example/login?invite=abc%2Fdef",
  );
});
