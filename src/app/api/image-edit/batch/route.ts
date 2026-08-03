import { requireActiveUser } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import { editImageBatch } from "@/server/services/image";
import { enforceRateLimit } from "@/server/rate-limit";

// 批量图生图限流：每用户 3 次/分钟（每张图内部还有单张接口的限流兜底）
const BATCH_LIMIT = 3;
const BATCH_WINDOW = 60;

// POST /api/image-edit/batch — 同参考图批量生成变体（最多 5 张）
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit(
    "image-batch-user",
    user.userId,
    BATCH_LIMIT,
    BATCH_WINDOW,
  );
  const body = await readJson<{
    image?: string;
    prompt?: string;
    model?: string;
    size?: string;
    count?: number;
  }>(req);

  const result = await editImageBatch({
    userId: user.userId,
    role: user.role,
    image: body.image || "",
    prompt: body.prompt || "",
    modelOverride: body.model,
    size: body.size,
    count: body.count,
  });
  return jsonOk(result);
});
