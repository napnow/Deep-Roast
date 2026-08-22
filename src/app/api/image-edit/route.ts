import { requireActiveUser } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { runImageEditTasks } from "@/server/services/image";
import { enforceRateLimit } from "@/server/rate-limit";
import type { ImageEditRequest } from "@/lib/image-edit-contract";

// 图生图限流：每用户 10 次/分钟（与文生图一致）
const IMAGE_LIMIT = 10;
const IMAGE_WINDOW = 60;

// POST /api/image-edit — edit image from reference image + prompt
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit("image-user", user.userId, IMAGE_LIMIT, IMAGE_WINDOW);
  const body = await readJson<ImageEditRequest>(req);

  const result = await runImageEditTasks({
    userId: user.userId,
    role: user.role,
    request: body,
    modelOverride: body.model,
    size: body.size,
    count: 1,
  });
  if (result.succeeded === 0) {
    throw new ApiError(result.lastError || "图生图失败", 500);
  }
  return jsonOk(result);
});
