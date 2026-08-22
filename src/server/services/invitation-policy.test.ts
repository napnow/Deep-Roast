import assert from "node:assert/strict";
import { test } from "node:test";
import { getInvitationReward } from "./invitation-policy";

test("ignores an invite code while invitation is disabled", () => {
  assert.equal(getInvitationReward(false, 200, true, "abc"), null);
});

test("returns configured reward for an active normal inviter", () => {
  assert.equal(getInvitationReward(true, 200, true, "abc"), 200);
});

test("rejects inactive inviters and preserves zero reward", () => {
  assert.equal(getInvitationReward(true, 200, false, "abc"), null);
  assert.equal(getInvitationReward(true, 0, true, "abc"), 0);
});
