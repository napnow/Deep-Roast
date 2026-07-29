import { getConfig } from "@/lib/config";
import { normalizeBaseUrl } from "@/server/providers/llm";
import { DEFAULT_TEXT_MODELS, DEFAULT_IMAGE_MODELS } from "@/types";
import { ApiError } from "@/server/http";

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
  /** 设置页当前填写的 API Key；留空则用已保存 key / env */
  apiKey?: string | null;
}

/**
 * 拉取「可选目录」（catalog），供设置页勾选启用。
 * 凭证优先级：请求体里用户当前输入 > DB 已保存 > 环境变量
 */
export async function fetchModelCatalog(input: FetchCatalogInput = {}) {
  const config = await getConfig();

  const baseUrl = normalizeBaseUrl(
    input.baseUrl?.trim() || config?.baseUrl || "",
  );
  const apiKey =
    input.apiKey?.trim() ||
    config?.arkApiKey?.trim() ||
    process.env.ARK_API_KEY ||
    process.env.GROK_API_KEY ||
    "";

  if (!baseUrl) {
    throw new ApiError("请先填写 API Base URL", 400);
  }
  if (!apiKey) {
    throw new ApiError(
      "请先填写 API Key（或确保设置/环境变量中已有可用 Key）",
      400,
    );
  }

  let remoteText: { id: string }[] = [];
  let remoteImage: { id: string }[] = [];
  let source: "remote" | "defaults" = "defaults";
  let warning: string | undefined;
  let upstreamCount = 0;

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      // 避免上游挂死拖垮设置页
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new ApiError(
        `从 ${baseUrl} 获取模型失败: HTTP ${res.status}${errText ? ` — ${errText.slice(0, 120)}` : ""}`,
        400,
      );
    }

    const data = await res.json();
    const models: { id: string }[] =
      data.data || (Array.isArray(data) ? data : []);
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
    const msg = err instanceof Error ? err.message : "未知错误";
    console.warn("获取模型目录异常:", msg);
    throw new ApiError(`从 ${baseUrl} 获取模型失败: ${msg}`, 400);
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
