import { getConfig } from "@/lib/config";
import { normalizeBaseUrl } from "@/server/providers/llm";
import { DEFAULT_TEXT_MODELS, DEFAULT_IMAGE_MODELS } from "@/types";
import { ApiError } from "@/server/http";
import {
  assertPublicHttpsUrl,
  requestPublicHttpsBuffer,
} from "@/server/safe-http";

function uniqById(list: { id: string }[]): { id: string }[] {
  const seen = new Set<string>();
  const out: { id: string }[] = [];
  for (const m of list) {
    if (!m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ id: m.id });
  }
  return out;
}

export interface FetchCatalogInput {
  /** 设置页当前填写的 Base URL（优先于已保存配置） */
  baseUrl?: string | null;
  /** 设置页当前填写的 API Key；自定义 Base URL 时必须显式提供 */
  apiKey?: string | null;
}

interface CatalogConfig {
  baseUrl?: string | null;
  arkApiKey?: string | null;
}

export function resolveCatalogEndpoint(
  input: FetchCatalogInput,
  config: CatalogConfig | null,
) {
  if (input.baseUrl !== undefined) {
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const apiKey = input.apiKey?.trim() || "";
    if (!baseUrl || !apiKey) {
      throw new ApiError("测试自定义 Base URL 时必须重新输入 API Key", 400);
    }
    assertPublicHttpsUrl(baseUrl);
    return { baseUrl, apiKey, custom: true as const };
  }

  const baseUrl = normalizeBaseUrl(config?.baseUrl || "");
  const apiKey =
    config?.arkApiKey?.trim() ||
    process.env.ARK_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    "";
  if (!baseUrl || !apiKey) {
    throw new ApiError("请先配置 API Base URL 和 API Key", 400);
  }
  return { baseUrl, apiKey, custom: false as const };
}

/**
 * 拉取「可选目录」（catalog），供设置页勾选启用。
 * 自定义 Base URL 只使用当前请求显式提供的凭证；已保存地址可继续使用 DB/env。
 */
export async function fetchModelCatalog(input: FetchCatalogInput = {}) {
  const config = await getConfig();
  const { baseUrl, apiKey, custom } = resolveCatalogEndpoint(input, config);

  let remoteText: { id: string }[] = [];
  let remoteImage: { id: string }[] = [];
  let source: "remote" | "defaults" = "defaults";
  let warning: string | undefined;
  let upstreamCount = 0;

  try {
    let status: number;
    let data: { data?: { id?: string }[] } | { id?: string }[];
    if (custom) {
      const result = await requestPublicHttpsBuffer(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 20_000,
        maxBytes: 2 * 1024 * 1024,
      });
      status = result.status;
      try {
        data = JSON.parse(result.body.toString("utf8")) as typeof data;
      } catch {
        throw new ApiError("上游返回的模型目录格式无效", 400);
      }
    } else {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      status = response.status;
      try {
        data = (await response.json()) as typeof data;
      } catch {
        throw new ApiError("上游返回的模型目录格式无效", 400);
      }
    }

    if (status < 200 || status >= 300) {
      throw new ApiError(`获取模型目录失败（上游 HTTP ${status}）`, 400);
    }

    const models: { id: string }[] =
      (Array.isArray(data) ? data : data.data || [])
        .filter((model): model is { id: string } =>
          Boolean(model && typeof model.id === "string"),
        )
        .map((model) => ({ id: model.id }));
    upstreamCount = models.filter((m) => m?.id).length;

    // 文本 / 多模态（图推也从这批选：gemini、gpt-4o、claude 等）
    const isText = (id: string) =>
      (id.startsWith("doubao-") ||
        id.startsWith("grok-") ||
        id.startsWith("gpt-") ||
        id.includes("seed") ||
        id.includes("chat") ||
        id.includes("claude") ||
        id.includes("gemini") ||
        id.includes("deepseek") ||
        id.includes("qwen") ||
        id.includes("vision") ||
        id.includes("vl")) &&
      !id.includes("seedream") &&
      !id.includes("imagine") &&
      id !== "gpt-image-2" &&
      !/image/i.test(id);

    const isImage = (id: string) =>
      id.includes("seedream") ||
      id.includes("imagine") ||
      id === "gpt-image-2" ||
      /image/i.test(id) ||
      id.includes("dall") ||
      id.includes("flux");

    remoteText = models
      .filter((m) => m.id && isText(m.id))
      .map((m) => ({ id: m.id }));
    remoteImage = models
      .filter((m) => m.id && isImage(m.id))
      .map((m) => ({ id: m.id }));

    // 分不进 text/image 的也放进 text，避免用户完全看不到
    const classified = new Set([
      ...remoteText.map((m) => m.id),
      ...remoteImage.map((m) => m.id),
    ]);
    for (const m of models) {
      if (m.id && !classified.has(m.id)) {
        remoteText.push({ id: m.id });
      }
    }

    source = "remote";
    if (upstreamCount === 0) {
      warning = `上游 ${baseUrl} 返回空列表`;
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.warn("获取模型目录异常", {
      custom,
      errorType: err instanceof Error ? err.name : typeof err,
    });
    throw new ApiError("获取模型目录失败，请检查地址、凭据和上游状态", 400);
  }

  return {
    baseUrl,
    textModels: uniqById([...remoteText, ...DEFAULT_TEXT_MODELS]),
    imageModels: uniqById([...remoteImage, ...DEFAULT_IMAGE_MODELS]),
    source,
    upstreamCount,
    warning,
  };
}

/** @deprecated 兼容旧名 */
export const fetchAvailableModels = fetchModelCatalog;
