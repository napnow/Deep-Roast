import { requireActiveAdmin } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { listUserImages } from "@/server/services/admin";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/admin/users/[id]/images
export const GET = handleRoute(async (req, ctx: Ctx) => {
  await requireActiveAdmin(req);
  const { id } = await ctx.params;
  return jsonOk(await listUserImages(id));
});
