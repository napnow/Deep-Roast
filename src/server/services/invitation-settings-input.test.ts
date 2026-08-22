import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "@/server/http";
import { parseInvitationSettingsPatch } from "./invitation-settings-input";

test("parses invitation settings together before any update is applied", () => {
  assert.deepEqual(
    parseInvitationSettingsPatch({
      invitationEnabled: false,
      invitationReward: "0",
      invitationInviteeReward: "50",
    }),
    {
      invitationEnabled: false,
      invitationReward: 0,
      invitationInviteeReward: 50,
    },
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

test("rejects an invalid invitee reward", () => {
  assert.throws(
    () =>
      parseInvitationSettingsPatch({
        invitationInviteeReward: 1.5,
      }),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
});
