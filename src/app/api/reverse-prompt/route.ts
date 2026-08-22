import { requireActiveUser } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { reversePromptFromImage } from "@/server/services/reverse-prompt";
import { enforceRateLimit } from "@/server/rate-limit";

/** 单张图片 base64 上限 ≈ 4MB（防超大上传耗尽内存/上游额度） */
const MAX_IMAGE_BASE64_LENGTH = 6_000_000;

// 反推限流：每用户 10 次/分钟
const REVERSE_LIMIT = 10;
const REVERSE_WINDOW = 60;

// POST /api/reverse-prompt — Gemini 视觉反推提示词 / 图生图
export const POST = handleRoute(async (req) => {
  const user = await requireActiveUser(req);
  await enforceRateLimit(
    "reverse-user",
    user.userId,
    REVERSE_LIMIT,
    REVERSE_WINDOW,
  );
  const body = await readJson<{
    imageBase64?: string;
    editDescription?: string;
  }>(req);
  if ((body.imageBase64 || "").length > MAX_IMAGE_BASE64_LENGTH) {
    throw new ApiError("图片过大（最大约 4MB）", 400);
  }
  const result = await reversePromptFromImage({
    imageBase64: body.imageBase64 || "",
    editDescription: body.editDescription,
  });
  return jsonOk(result);
});
