import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  clearAdminContactImage,
  getSiteSettings,
  setRegistrationEnabled,
  updateAdminContactText,
} from "@/server/services/site-settings";

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
  }>(req);

  if (body.clearImage === true) {
    await clearAdminContactImage();
  }
  if (typeof body.registrationEnabled === "boolean") {
    await setRegistrationEnabled(body.registrationEnabled);
  }
  if (typeof body.adminContactText === "string") {
    return jsonOk(await updateAdminContactText(body.adminContactText));
  }
  return jsonOk(await getSiteSettings());
});
