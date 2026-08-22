export function getInvitationReward(
  enabled: boolean,
  configuredReward: number,
  inviterIsActiveUser: boolean,
  inviteCode: string | null,
): number | null {
  if (!enabled || !inviteCode || !inviterIsActiveUser) return null;
  return Math.max(0, Math.trunc(configuredReward));
}

export function getInviteeInvitationReward(
  enabled: boolean,
  configuredReward: number,
  inviteeIsActiveUser: boolean,
  inviteCode: string | null,
): number | null {
  if (!enabled || !inviteCode || !inviteeIsActiveUser) return null;
  return Math.max(0, Math.trunc(configuredReward));
}
