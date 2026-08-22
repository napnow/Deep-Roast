import { parseInvitationReward } from "./invitations";

export interface InvitationSettingsPatch {
  invitationEnabled?: boolean;
  invitationReward?: number;
}

export function parseInvitationSettingsPatch(body: {
  invitationEnabled?: unknown;
  invitationReward?: unknown;
}): InvitationSettingsPatch {
  const patch: InvitationSettingsPatch = {};
  if (typeof body.invitationEnabled === "boolean") {
    patch.invitationEnabled = body.invitationEnabled;
  }
  if (body.invitationReward !== undefined) {
    patch.invitationReward = parseInvitationReward(body.invitationReward);
  }
  return patch;
}
