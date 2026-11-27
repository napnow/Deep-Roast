import {
  GEMINI_IMAGE_UPSTREAM_MODEL,
  geminiImageSize,
} from "@/lib/image-model-capabilities";
import { ApiError } from "@/server/http";

export interface GeminiInlineImage {
  mimeType: string;
  data: string;
}

/**
 * 渠道里保存的 Base URL 可能已经带了 /v1（OpenAI 兼容写法），
 * Gemini 原生接口挂在 /v1beta 下，需要先退回站点根路径。
 */
export function geminiImageRoot(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(v1|v1beta)$/i, "");
}

/** Flow2API 只有流式接口能跑完长任务，非流式会被预览隧道提前掐断。 */
export function geminiGenerateUrl(baseUrl: string): string {
  return `${geminiImageRoot(baseUrl)}/v1beta/models/${GEMINI_IMAGE_UPSTREAM_MODEL}:streamGenerateContent?alt=sse`;
}

export function buildGeminiImagePayload(opts: {
  prompt: string;
  aspectRatio: string;
  model: string;
}): unknown {
  const imageConfig: { aspectRatio: string; imageSize?: "1K" | "2K" } = {
    aspectRatio: opts.aspectRatio,
  };
  const size = geminiImageSize(opts.model);
  if (size === "2K") imageConfig.imageSize = size;
  return {
    contents: [{ parts: [{ text: opts.prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig,
    },
  };
}

function firstInlineImage(value: unknown): GeminiInlineImage | null {
  const candidates = (value as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates)) return null;
  for (const candidate of candidates) {
    const parts = (candidate as { content?: { parts?: unknown } })?.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const inline =
        (part as {
          inlineData?: { data?: unknown; mimeType?: unknown };
          inline_data?: { data?: unknown; mime_type?: unknown };
        })?.inlineData ?? (part as { inline_data?: unknown })?.inline_data;
      const data = (inline as { data?: unknown })?.data;
      if (typeof data !== "string" || !data) continue;
      const mimeType =
        (inline as { mimeType?: unknown; mime_type?: unknown })?.mimeType ??
        (inline as { mime_type?: unknown })?.mime_type;
      return {
        mimeType: typeof mimeType === "string" && mimeType ? mimeType : "image/png",
        data,
      };
    }
  }
  return null;
}

function extractGeminiSafetyBlock(value: unknown): ApiError | null {
  const blockReason = (
    value as { promptFeedback?: { blockReason?: unknown } }
  )?.promptFeedback?.blockReason;
  if (typeof blockReason === "string" && blockReason) {
    return new ApiError(
      "图片未通过上游内容审核，可能涉及上游内容限制。请检查并调整提示词后重试。",
      400,
      "IMAGE_CONTENT_POLICY",
    );
  }
  const candidates = (value as { candidates?: unknown })?.candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const finishReason = (candidate as { finishReason?: unknown })?.finishReason;
      if (
        typeof finishReason === "string" &&
        /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/i.test(finishReason)
      ) {
        return new ApiError(
          "图片未通过上游内容审核，可能涉及上游内容限制。请检查并调整提示词后重试。",
          400,
          "IMAGE_CONTENT_POLICY",
        );
      }
    }
  }
  return null;
}

export function extractGeminiInlineImage(value: unknown): GeminiInlineImage | null {
  return firstInlineImage(value);
}

/** 解析 SSE 事件流，返回最后一张完整图片。 */
export async function readGeminiSseImage(
  stream: ReadableStream<Uint8Array> | null,
): Promise<GeminiInlineImage> {
  if (!stream) {
    throw new ApiError("上游图片服务未返回内容", 502, "UPSTREAM_IMAGE_ERROR");
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let image: GeminiInlineImage | null = null;
  let policyBlock: ApiError | null = null;

  const consumeLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const parsed = JSON.parse(payload) as unknown;
      const found = firstInlineImage(parsed);
      if (found) image = found;
      const safety = extractGeminiSafetyBlock(parsed);
      if (safety) policyBlock = safety;
    } catch {
      /* 忽略非 JSON 的心跳行 */
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) consumeLine(buffer);
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        consumeLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!image) {
    if (policyBlock) throw policyBlock;
    throw new ApiError("上游未返回图片", 502, "UPSTREAM_IMAGE_ERROR");
  }
  return image;
}
