import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveCheckinReward,
  resolveRegistrationBenefits,
  resolveRestrictedInviterReward,
} from "./registration-benefits";

const now = new Date("2026-11-03T00:00:00.000Z");
const future = new Date("2026-12-03T00:00:00.000Z");
const past = new Date("2026-11-02T00:00:00.000Z");
const settings = {
  repeatRegistrationLimitEnabled: true,
  repeatRegistrationSignupBonus: 0,
  repeatRegistrationCheckinReward: 10,
  repeatRegistrationInvitationReward: 0,
  signupBonusCredits: 20,
  checkinReward: 20,
};

test("active risk marks lower signup benefits and suppress invitations", () => {
  assert.deepEqual(
    resolveRegistrationBenefits(settings, future, now),
    {
      restricted: true,
      signupBonusCredits: 0,
      restrictedUntil: future,
    },
  );
});

test("missing or expired risk marks keep normal signup benefits", () => {
  assert.deepEqual(
    resolveRegistrationBenefits(settings, null, now),
    {
      restricted: false,
      signupBonusCredits: 20,
      restrictedUntil: null,
    },
  );
  assert.deepEqual(
    resolveRegistrationBenefits(settings, past, now),
    {
      restricted: false,
      signupBonusCredits: 20,
      restrictedUntil: null,
    },
  );
});

test("disabled repeat-registration policy keeps normal signup benefits", () => {
  const result = resolveRegistrationBenefits(
    { ...settings, repeatRegistrationLimitEnabled: false },
    future,
    now,
  );
  assert.equal(result.restricted, false);
  assert.equal(result.signupBonusCredits, 20);
});

test("active restrictions lower check-in rewards until expiry", () => {
  assert.equal(resolveCheckinReward(settings, future, now), 10);
  assert.equal(resolveCheckinReward(settings, past, now), 20);
  assert.equal(resolveCheckinReward(settings, null, now), 20);
  assert.equal(
    resolveCheckinReward(
      { ...settings, repeatRegistrationLimitEnabled: false },
      future,
      now,
    ),
    20,
  );
});

test("restricted accounts earn the restricted inviter reward while active", () => {
  assert.equal(resolveRestrictedInviterReward(settings, future, now), 0);
  assert.equal(
    resolveRestrictedInviterReward(
      { ...settings, repeatRegistrationInvitationReward: 25 },
      future,
      now,
    ),
    25,
  );
  assert.equal(resolveRestrictedInviterReward(settings, past, now), null);
  assert.equal(resolveRestrictedInviterReward(settings, null, now), null);
  assert.equal(
    resolveRestrictedInviterReward(
      { ...settings, repeatRegistrationLimitEnabled: false },
      future,
      now,
    ),
    null,
  );
});
