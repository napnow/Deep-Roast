/**
 * 按模型解析上游 API 端点（豆包 / Grok / GPT Image / Gemini）。
 *
 * 优先级：设置页（DB config）> 环境变量。
 * 用户在 UI 改的 Base URL / API Key 必须能覆盖 .env，否则会感觉「配置没生效」。
 * 无内置第三方中转默认地址（开源安全：避免硬编码他人服务）。
 */

export type LlmKind = "text" | "image" | "vision";

export interface UpstreamEndpoint {
  apiKey: string;
  baseUrl: string;
  maxRetries: number;
}

interface ConfigLike {
  arkApiKey?: string | null;
  baseUrl?: string | null;
}

/** OpenAI 兼容接口通常挂在 /v1；用户只填主机时自动补上 */
export function normalizeBaseUrl(url?: string | null): string {
  if (!url?.trim()) return "";
  const raw = url.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(raw);
    if (parsed.pathname === "" || parsed.pathname === "/") {
      return `${raw}/v1`;
    }
  } catch {
    /* 非法 URL 原样返回，由上游报错 */
  }
  return raw;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export function resolveChatEndpoint(
  model: string,
  config: ConfigLike,
): UpstreamEndpoint {
  const isGrok = model.startsWith("grok-");
  const configBase = normalizeBaseUrl(config.baseUrl);
  const configKey = config.arkApiKey?.trim() || "";

  if (isGrok) {
    return {
      apiKey: firstNonEmpty(configKey, process.env.GROK_API_KEY),
      baseUrl: firstNonEmpty(configBase, process.env.GROK_BASE_URL),
      maxRetries: 1,
    };
  }

  return {
    apiKey: firstNonEmpty(configKey, process.env.ARK_API_KEY),
    baseUrl: firstNonEmpty(configBase),
    maxRetries: 1,
  };
}

export function resolveImageEndpoint(
  model: string,
  config: ConfigLike,
): UpstreamEndpoint {
  const isGrok = model.startsWith("grok-");
  const isGptImage = model === "gpt-image-2";
  const configBase = normalizeBaseUrl(config.baseUrl);
  const configKey = config.arkApiKey?.trim() || "";

  if (isGrok) {
    return {
      apiKey: firstNonEmpty(configKey, process.env.GROK_API_KEY),
      baseUrl: firstNonEmpty(configBase, process.env.GROK_BASE_URL),
      maxRetries: 3,
    };
  }

  if (isGptImage) {
    return {
      apiKey: firstNonEmpty(
        configKey,
        process.env.GPT_IMAGE_KEY,
        process.env.ARK_API_KEY,
      ),
      baseUrl: firstNonEmpty(
        configBase,
        process.env.GPT_IMAGE_BASE_URL,
      ),
      maxRetries: 1,
    };
  }

  return {
    apiKey: firstNonEmpty(configKey, process.env.ARK_API_KEY),
    baseUrl: firstNonEmpty(configBase),
    maxRetries: 1,
  };
}

export function resolveGeminiEndpoint(config?: ConfigLike): UpstreamEndpoint {
  const configBase = normalizeBaseUrl(config?.baseUrl);
  const configKey = config?.arkApiKey?.trim() || "";
  return {
    apiKey: firstNonEmpty(
      configKey,
      process.env.GEMINI_API_KEY,
      process.env.ARK_API_KEY,
    ),
    baseUrl: firstNonEmpty(
      configBase,
      process.env.GEMINI_BASE_URL,
    ),
    maxRetries: 1,
  };
}

/** 图推 / 视觉反推：Gemini 模型优先走 Gemini 端点，其余走对话端点 */
export function resolveVisionEndpoint(
  model: string,
  config: ConfigLike,
): UpstreamEndpoint {
  const id = model.trim().toLowerCase();
  if (id.includes("gemini")) {
    return resolveGeminiEndpoint(config);
  }
  return resolveChatEndpoint(model, config);
}

export function systemPromptForModel(model: string): string {
  if (model.startsWith("grok-")) {
    return "你是 Grok，由 xAI 开发。用中文回复，简洁友好。";
  }
  return "你是豆包 AI 助手，由字节跳动开发。用中文回复，简洁友好。";
}
