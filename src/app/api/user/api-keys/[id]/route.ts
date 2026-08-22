import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk } from "@/server/http";
import { revokeApiKey } from "@/server/services/api-keys";

// DELETE /api/user/api-keys/[id] — 删除（停用）我的 key
export const DELETE = handleRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireActiveUser(req);
  const { id } = await params;
  return jsonOk(await revokeApiKey(id, user.userId));
});
