import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  clearAdminContactImage,
  clearDonationImage,
  getSiteSettings,
  updateInvitationSettings,
  setDonationEnabled,
  setImageGenerationEnabled,
  setRegistrationEnabled,
  updateAdminContactText,
  updateDonationText,
} from "@/server/services/site-settings";
import { parseInvitationSettingsPatch } from "@/server/services/invitation-settings-input";

export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  return jsonOk(await getSiteSettings());
});

export const PUT = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  const body = await readJson<{
    adminContactText?: string;
    clearImage?: boolean;
    registrationEnabled?: boolean;
    imageGenerationEnabled?: boolean;
    donationEnabled?: boolean;
    donationText?: string;
    clearDonationImage?: boolean;
    invitationEnabled?: boolean;
    invitationReward?: number | string;
  }>(req);

  const invitationPatch = parseInvitationSettingsPatch(body);

  if (body.clearImage === true) {
    await clearAdminContactImage();
  }
  if (body.clearDonationImage === true) {
    await clearDonationImage();
  }
  if (typeof body.registrationEnabled === "boolean") {
    await setRegistrationEnabled(body.registrationEnabled);
  }
  if (typeof body.imageGenerationEnabled === "boolean") {
    await setImageGenerationEnabled(body.imageGenerationEnabled);
  }
  if (typeof body.donationEnabled === "boolean") {
    await setDonationEnabled(body.donationEnabled);
  }
  if (Object.keys(invitationPatch).length > 0) {
    await updateInvitationSettings(invitationPatch);
  }
  if (typeof body.donationText === "string") {
    await updateDonationText(body.donationText);
  }
  if (typeof body.adminContactText === "string") {
    return jsonOk(await updateAdminContactText(body.adminContactText));
  }
  return jsonOk(await getSiteSettings());
});
