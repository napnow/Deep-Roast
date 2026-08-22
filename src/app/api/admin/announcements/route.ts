import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  createAnnouncement,
  listAnnouncements,
} from "@/server/services/announcements";

export const GET = handleRoute(async (req) => {
  await requireActiveAdmin(req);
  return jsonOk({ announcements: await listAnnouncements(50) });
});

export const POST = handleRoute(async (req) => {
  const admin = await requireActiveAdmin(req);
  const body = await readJson<{ body?: string }>(req);
  return jsonOk(await createAnnouncement(body.body || "", admin.userId));
});
