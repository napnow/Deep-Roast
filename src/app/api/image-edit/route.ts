import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import { editImage } from "@/server/services/image";
import { enforceRateLimit } from "@/server/rate-limit";

// 图生图限流：每用户 10 次/分钟（与文生图一致）
const IMAGE_LIMIT = 10;
const IMAGE_WINDOW = 60;

// POST /api/image-edit — edit image from reference image + prompt
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit("image-user", user.userId, IMAGE_LIMIT, IMAGE_WINDOW);
  const body = await readJson<{
    image?: string;
    prompt?: string;
    model?: string;
    size?: string;
  }>(req);

  const result = await editImage({
    userId: user.userId,
    role: user.role,
    image: body.image || "",
    prompt: body.prompt || "",
    modelOverride: body.model,
    size: body.size,
  });
  return jsonOk(result);
});
