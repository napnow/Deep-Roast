import { requireAdmin } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  clearAdminContactImage,
  getSiteSettings,
  updateAdminContactText,
} from "@/server/services/site-settings";

export const GET = handleRoute(async (req) => {
  requireAdmin(req);
  return jsonOk(await getSiteSettings());
});

export const PUT = handleRoute(async (req) => {
  requireAdmin(req);
  const body = await readJson<{
    adminContactText?: string;
    clearImage?: boolean;
  }>(req);

  if (body.clearImage === true) {
    await clearAdminContactImage();
  }
  if (typeof body.adminContactText === "string") {
    return jsonOk(await updateAdminContactText(body.adminContactText));
  }
  return jsonOk(await getSiteSettings());
});
