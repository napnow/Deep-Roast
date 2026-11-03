import { ApiError } from "@/server/http";
import { parseCheckinReward } from "./checkin-settings-input";
import { parseInvitationReward } from "./invitations";
import { parseSignupBonusCredits } from "./signup-bonus-settings-input";

export interface RepeatRegistrationSettingsPatch {
  repeatRegistrationLimitEnabled?: boolean;
  repeatRegistrationWindowDays?: number;
  repeatRegistrationSignupBonus?: number;
  repeatRegistrationCheckinReward?: number;
  repeatRegistrationInvitationReward?: number;
}

function parseWindowDays(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 365) {
    throw new ApiError("重复注册限制天数必须是 1-365 的整数", 400);
  }
  return parsed;
}

export function parseRepeatRegistrationSettingsPatch(body: {
  repeatRegistrationLimitEnabled?: unknown;
  repeatRegistrationWindowDays?: unknown;
  repeatRegistrationSignupBonus?: unknown;
  repeatRegistrationCheckinReward?: unknown;
  repeatRegistrationInvitationReward?: unknown;
}): RepeatRegistrationSettingsPatch {
  const patch: RepeatRegistrationSettingsPatch = {};

  if (body.repeatRegistrationLimitEnabled !== undefined) {
    if (typeof body.repeatRegistrationLimitEnabled !== "boolean") {
      throw new ApiError("重复注册限制开关必须是布尔值", 400);
    }
    patch.repeatRegistrationLimitEnabled = body.repeatRegistrationLimitEnabled;
  }
  if (body.repeatRegistrationWindowDays !== undefined) {
    patch.repeatRegistrationWindowDays = parseWindowDays(
      body.repeatRegistrationWindowDays,
    );
  }
  if (body.repeatRegistrationSignupBonus !== undefined) {
    patch.repeatRegistrationSignupBonus = parseSignupBonusCredits(
      body.repeatRegistrationSignupBonus,
    );
  }
  if (body.repeatRegistrationCheckinReward !== undefined) {
    patch.repeatRegistrationCheckinReward = parseCheckinReward(
      body.repeatRegistrationCheckinReward,
    );
  }
  if (body.repeatRegistrationInvitationReward !== undefined) {
    patch.repeatRegistrationInvitationReward = parseInvitationReward(
      body.repeatRegistrationInvitationReward,
    );
  }

  return patch;
}
