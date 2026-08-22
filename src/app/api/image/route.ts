import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import { generateImage } from "@/server/services/image";
import { enforceRateLimit } from "@/server/rate-limit";

// 生图限流：每用户 10 次/分钟
const IMAGE_LIMIT = 10;
const IMAGE_WINDOW = 60;

// POST /api/image — generate image from text prompt
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit("image-user", user.userId, IMAGE_LIMIT, IMAGE_WINDOW);
  const body = await readJson<{
    prompt?: string;
    model?: string;
    size?: string;
  }>(req);

  const result = await generateImage({
    userId: user.userId,
    role: user.role,
    prompt: body.prompt || "",
    modelOverride: body.model,
    size: body.size,
  });
  return jsonOk(result);
});
