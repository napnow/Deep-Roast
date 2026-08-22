import { parseInvitationReward } from "./invitations";

export interface InvitationSettingsPatch {
  invitationEnabled?: boolean;
  invitationReward?: number;
  invitationInviteeReward?: number;
}

export function parseInvitationSettingsPatch(body: {
  invitationEnabled?: unknown;
  invitationReward?: unknown;
  invitationInviteeReward?: unknown;
}): InvitationSettingsPatch {
  const patch: InvitationSettingsPatch = {};
  if (typeof body.invitationEnabled === "boolean") {
    patch.invitationEnabled = body.invitationEnabled;
  }
  if (body.invitationReward !== undefined) {
    patch.invitationReward = parseInvitationReward(body.invitationReward);
  }
  if (body.invitationInviteeReward !== undefined) {
    patch.invitationInviteeReward = parseInvitationReward(
      body.invitationInviteeReward,
    );
  }
  return patch;
}
