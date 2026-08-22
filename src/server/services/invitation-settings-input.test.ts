import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "@/server/http";
import { parseInvitationSettingsPatch } from "./invitation-settings-input";

test("parses invitation settings together before any update is applied", () => {
  assert.deepEqual(
    parseInvitationSettingsPatch({
      invitationEnabled: false,
      invitationReward: "0",
    }),
    { invitationEnabled: false, invitationReward: 0 },
  );
});

test("rejects an invalid reward even when the toggle is also present", () => {
  assert.throws(
    () =>
      parseInvitationSettingsPatch({
        invitationEnabled: true,
        invitationReward: -1,
      }),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
});
