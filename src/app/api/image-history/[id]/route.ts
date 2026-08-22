import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { deleteImageRecord } from "@/server/services/image";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/image-history/[id]
export const DELETE = handleRoute(async (req, ctx: Ctx) => {
  const { userId } = await requireActiveUser(req);
  const { id } = await ctx.params;
  return jsonOk(await deleteImageRecord(userId, id));
});
