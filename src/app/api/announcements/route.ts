import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { listAnnouncements } from "@/server/services/announcements";

export const GET = handleRoute(async (req) => {
  await requireActiveUser(req);
  return jsonOk({ announcements: await listAnnouncements(20) });
});
