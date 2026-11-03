import { isRegistrationRestricted } from "./registration-risk";

export interface RegistrationBenefitSettings {
  repeatRegistrationLimitEnabled: boolean;
  repeatRegistrationSignupBonus: number;
  repeatRegistrationCheckinReward: number;
  repeatRegistrationInvitationReward: number;
  signupBonusCredits: number;
  checkinReward: number;
}

export function resolveRegistrationBenefits(
  settings: RegistrationBenefitSettings,
  restrictedUntil: Date | null | undefined,
  now = new Date(),
) {
  const restricted =
    settings.repeatRegistrationLimitEnabled &&
    isRegistrationRestricted(restrictedUntil, now);

  return {
    restricted,
    signupBonusCredits: restricted
      ? settings.repeatRegistrationSignupBonus
      : settings.signupBonusCredits,
    restrictedUntil: restricted && restrictedUntil ? restrictedUntil : null,
  };
}

export function resolveCheckinReward(
  settings: RegistrationBenefitSettings,
  restrictedUntil: Date | null | undefined,
  now = new Date(),
): number {
  const restricted =
    settings.repeatRegistrationLimitEnabled &&
    isRegistrationRestricted(restrictedUntil, now);
  return restricted
    ? settings.repeatRegistrationCheckinReward
    : settings.checkinReward;
}

/**
 * 受限账号作为邀请人时的奖励。
 * 返回 null 表示未受限，由常规邀请奖励规则决定。
 */
export function resolveRestrictedInviterReward(
  settings: RegistrationBenefitSettings,
  inviterRestrictedUntil: Date | null | undefined,
  now = new Date(),
): number | null {
  const restricted =
    settings.repeatRegistrationLimitEnabled &&
    isRegistrationRestricted(inviterRestrictedUntil, now);
  return restricted ? settings.repeatRegistrationInvitationReward : null;
}
