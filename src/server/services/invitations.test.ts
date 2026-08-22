import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInvitationReward } from "./invitations";

test("accepts zero but rejects negative and fractional rewards", () => {
  assert.equal(parseInvitationReward(0), 0);
  assert.equal(parseInvitationReward("200"), 200);
  assert.throws(() => parseInvitationReward(-1));
  assert.throws(() => parseInvitationReward(1.5));
});
