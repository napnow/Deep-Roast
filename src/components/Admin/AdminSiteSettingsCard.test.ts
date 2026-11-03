import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("admin site settings exposes the registration IP limit toggle", () => {
  const source = readFileSync(
    "src/components/Admin/AdminSiteSettingsCard.tsx",
    "utf8",
  );
  assert.match(source, /registrationIpLimitEnabled/);
  assert.match(source, /同 IP 注册限制/);
  assert.match(source, /限制中/);
  assert.match(source, /已关闭/);
});

test("admin site settings exposes the repeat-registration restriction controls", () => {
  const source = readFileSync(
    "src/components/Admin/AdminSiteSettingsCard.tsx",
    "utf8",
  );
  assert.match(source, /清理后重注册限制/);
  assert.match(source, /repeatRegistrationLimitEnabled/);
  assert.match(source, /repeatRegistrationWindowDays/);
  assert.match(source, /repeatRegistrationSignupBonus/);
  assert.match(source, /repeatRegistrationCheckinReward/);
  assert.match(source, /repeatRegistrationInvitationReward/);
  assert.match(source, /受限注册赠送积分/);
  assert.match(source, /受限签到奖励积分/);
  assert.match(source, /受限账号邀请奖励/);
});
