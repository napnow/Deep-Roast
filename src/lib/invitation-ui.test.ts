import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldShowInvitationPanel } from "./invitation-ui";

test("only exposes the invitation panel to eligible users", () => {
  assert.equal(shouldShowInvitationPanel({ eligible: true }), true);
  assert.equal(shouldShowInvitationPanel({ eligible: false }), false);
});
