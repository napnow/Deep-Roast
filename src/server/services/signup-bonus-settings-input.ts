import { ApiError } from "@/server/http";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

export interface SignupBonusSettingsPatch {
  signupBonusCredits?: number;
}

export function parseSignupBonusCredits(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > POSTGRES_INTEGER_MAX
  ) {
    throw new ApiError("注册赠送积分必须是非负整数", 400);
  }

  return parsed;
}

export function parseSignupBonusSettingsPatch(body: {
  signupBonusCredits?: unknown;
}): SignupBonusSettingsPatch {
  if (body.signupBonusCredits === undefined) return {};
  return {
    signupBonusCredits: parseSignupBonusCredits(body.signupBonusCredits),
  };
}
