import { getConfig } from "@/lib/config";
import { ApiError } from "@/server/http";
import { resolveConfiguredEndpoint } from "@/server/services/model-channels";
import { requestPublicHttpsResponse } from "@/server/safe-http";

const REVERSE_PROMPT_TIMEOUT_MS = 120_000;
const REVERSE_PROMPT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export async function reversePromptFromImage(opts: {
  imageBase64: string;
  editDescription?: string;
}): Promise<{ prompt: string; model: string }> {
  const { imageBase64, editDescription } = opts;

  if (!imageBase64) throw new ApiError("imageBase64 为必填项", 400);
  if (!imageBase64.startsWith("data:image/")) {
    throw new ApiError(
      "imageBase64 必须是 data URL 格式 (data:image/...;base64,...)",
      400,
    );
  }

  const config = await getConfig();
  // 图推模型：设置页显式配置 > 文生文默认模型；不再写死 gemini
  const model =
    config?.reversePromptModel?.trim() || config?.textModel?.trim() || "";
  if (!model) {
    throw new ApiError(
      "请先在设置中选择图推模型（获取模型后点选），或至少配置文生文模型",
      400,
    );
  }

  const { apiKey, baseUrl, enforcePublicHttps } = await resolveConfiguredEndpoint("vision", model, {
    arkApiKey: config?.arkApiKey,
    baseUrl: config?.baseUrl,
  });

  if (!apiKey) {
    throw new ApiError(
      "请先在设置中配置 API Key，或在 .env 中设置 GEMINI_API_KEY / ARK_API_KEY",
      400,
    );
  }
  if (!baseUrl) {
    throw new ApiError(
      "请先在设置中配置 API Base URL，或在 .env 中设置 GEMINI_BASE_URL",
      400,
    );
  }

  const isImg2Img = !!editDescription?.trim();
  const textPrompt = isImg2Img
    ? `请先简要描述这张参考图片的内容和风格，然后根据用户的修改要求，将其转化为一段完整的AI生图提示词（中文）。\n\n用户的修改要求：${editDescription}\n\n规则：\n1. 保留参考图的核心构图和主体\n2. 融入修改要求中的风格/元素变化\n3. 输出一段完整的生图提示词，尽可能详细准确\n4. 只输出提示词本身，不要加任何解释前缀。`
    : "请详细描述这张图片的内容、风格、构图、色彩、光影和细节。输出一段可以直接用于AI图片生成的提示词（中文），尽可能详细和准确。只输出提示词本身，不要加任何解释前缀。";

  const upstreamUrl = `${baseUrl}/chat/completions`;
  const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
  const body = JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageBase64 } },
            { type: "text", text: textPrompt },
          ],
        },
      ],
      max_tokens: 1000,
    });
  const res = enforcePublicHttps
    ? await requestPublicHttpsResponse(upstreamUrl, {
        method: "POST",
        headers,
        body,
        timeoutMs: REVERSE_PROMPT_TIMEOUT_MS,
        maxBytes: REVERSE_PROMPT_MAX_RESPONSE_BYTES,
      })
    : await fetch(upstreamUrl, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(REVERSE_PROMPT_TIMEOUT_MS),
        headers,
        body,
      });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Reverse prompt error:", res.status, errText);
    throw new ApiError(`图片分析失败: ${res.status}`, 500);
  }

  const result = await res.json();
  const prompt = result.choices?.[0]?.message?.content?.trim();
  if (!prompt) throw new ApiError("未能从图片中提取提示词", 500);

  console.log("Reverse prompt success, model:", model, "length:", prompt.length);
  return { prompt, model };
}
