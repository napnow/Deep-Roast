import { handleRoute, jsonOk } from "@/server/http";
import { listAnnouncements } from "@/server/services/announcements";

export const GET = handleRoute(async () => {
  return jsonOk({ announcements: await listAnnouncements(20) });
});
