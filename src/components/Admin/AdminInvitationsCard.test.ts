import assert from "node:assert/strict";
import { test } from "node:test";
import { formatInvitationUsername } from "../../lib/invitation-ui";

test("uses the username snapshot when the related account was deleted", () => {
  assert.equal(
    formatInvitationUsername({ snapshot: "old-user", current: null }),
    "old-user",
  );
});
