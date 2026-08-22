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
    image?: string | string[];
    prompt?: string;
    model?: string;
    size?: string;
  }>(req);

  const result = await editImage({
    userId: user.userId,
    role: user.role,
    image: body.image || [],
    prompt: body.prompt || "",
    modelOverride: body.model,
    size: body.size,
  });
  // 统一返回 images 数组（单图 = 1 个元素，多图逐张生成 = 每张一个元素）
  return jsonOk({ images: Array.isArray(result) ? result : [result] });
});
