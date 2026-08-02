import { db } from "@/db";
import { llmConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_IMAGE_MODELS } from "@/types";

const DEFAULT_IMAGE_IDS = DEFAULT_IMAGE_MODELS.map((m) => m.id);

/**
 * 读取 LLM 配置。
 * - arkApiKey 只反映 DB 中的设置（设置页写入的值）
 * - 环境变量作为 resolve*Endpoint 的回退，不在这里合并进 arkApiKey
 */
export async function getConfig() {
  const configs = await db.select().from(llmConfig).where(eq(llmConfig.id, 1));
  const config = configs[0];
  if (!config) return null;
  return config;
}

/** 是否具备任意可用上游凭证（设置页或 env） */
export function hasAnyApiCredential(
  config: { arkApiKey?: string | null } | null,
): boolean {
  return !!(
    config?.arkApiKey?.trim() ||
    process.env.ARK_API_KEY ||
    process.env.GROK_API_KEY ||
    process.env.GPT_IMAGE_KEY
  );
}

/** 解析启用模型 JSON；空则回落默认；可把当前默认模型钉在列表里 */
export function parseEnabledModels(
  raw: string | null | undefined,
  fallback: string[],
  pin?: string | null,
): string[] {
  let ids: string[] = [];
  try {
    const arr = JSON.parse(raw || "[]");
    if (Array.isArray(arr)) {
      ids = arr
        .filter((x): x is string => typeof x === "string" && !!x.trim())
        .map((s) => s.trim());
    }
  } catch {
    ids = [];
  }
  if (ids.length === 0) ids = [...fallback];
  if (pin?.trim() && !ids.includes(pin.trim())) {
    ids = [pin.trim(), ...ids];
  }
  // 去重保序
  return [...new Set(ids)];
}

export function defaultImageModelIds() {
  return [...DEFAULT_IMAGE_IDS];
}

export function serializeModelIds(ids: string[]): string {
  const cleaned = [
    ...new Set(
      ids
        .filter((x) => typeof x === "string" && x.trim())
        .map((s) => s.trim()),
    ),
  ];
  return JSON.stringify(cleaned);
}
