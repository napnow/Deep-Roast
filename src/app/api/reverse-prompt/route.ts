import { handleRoute, jsonOk, readJson } from "@/server/http";
import { reversePromptFromImage } from "@/server/services/reverse-prompt";

// POST /api/reverse-prompt — Gemini 视觉反推提示词 / 图生图
export const POST = handleRoute(async (req) => {
  const body = await readJson<{
    imageBase64?: string;
    editDescription?: string;
  }>(req);
  const result = await reversePromptFromImage({
    imageBase64: body.imageBase64 || "",
    editDescription: body.editDescription,
  });
  return jsonOk(result);
});
