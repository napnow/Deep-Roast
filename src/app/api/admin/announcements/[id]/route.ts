import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { deleteAnnouncement } from "@/server/services/announcements";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handleRoute(async (req, _ctx) => {
  await requireActiveAdmin(req);
  const { id } = await (_ctx as Ctx).params;
  return jsonOk(await deleteAnnouncement(id));
});
