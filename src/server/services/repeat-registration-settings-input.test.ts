import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRepeatRegistrationSettingsPatch } from "./repeat-registration-settings-input";

test("parses repeat registration settings", () => {
  assert.deepEqual(
    parseRepeatRegistrationSettingsPatch({
      repeatRegistrationLimitEnabled: true,
      repeatRegistrationWindowDays: "30",
      repeatRegistrationSignupBonus: 0,
      repeatRegistrationCheckinReward: "10",
      repeatRegistrationInvitationReward: "0",
    }),
    {
      repeatRegistrationLimitEnabled: true,
      repeatRegistrationWindowDays: 30,
      repeatRegistrationSignupBonus: 0,
      repeatRegistrationCheckinReward: 10,
      repeatRegistrationInvitationReward: 0,
    },
  );
});

test("rejects malformed repeat registration settings", () => {
  assert.throws(() =>
    parseRepeatRegistrationSettingsPatch({
      repeatRegistrationLimitEnabled: "true",
    }),
  );
  assert.throws(() =>
    parseRepeatRegistrationSettingsPatch({
      repeatRegistrationWindowDays: 0,
    }),
  );
  assert.throws(() =>
    parseRepeatRegistrationSettingsPatch({
      repeatRegistrationWindowDays: 366,
    }),
  );
  assert.throws(() =>
    parseRepeatRegistrationSettingsPatch({
      repeatRegistrationSignupBonus: -1,
    }),
  );
  assert.throws(() =>
    parseRepeatRegistrationSettingsPatch({
      repeatRegistrationCheckinReward: 1.5,
    }),
  );
  assert.throws(() =>
    parseRepeatRegistrationSettingsPatch({
      repeatRegistrationInvitationReward: -5,
    }),
  );
});
