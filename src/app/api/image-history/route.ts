import { requireActiveUser } from "@/server/auth";
import { ApiError, handleRoute, jsonOk } from "@/server/http";
import { listImageHistory, normalizeImageOrigin } from "@/server/services/image";

// GET /api/image-history
export const GET = handleRoute(async (req) => {
  const { userId } = await requireActiveUser(req);
  const params = new URL(req.url).searchParams;
  const rawLimit = params.get("limit");
  const rawOffset = params.get("offset");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100
    || !Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw new ApiError("作品分页参数无效", 400, "INVALID_IMAGE_HISTORY_PAGE");
  }
  const rawOrigin = params.get("origin");
  const origin = rawOrigin === null ? undefined : normalizeImageOrigin(rawOrigin);
  return jsonOk(await listImageHistory(userId, limit, offset, origin));
});
