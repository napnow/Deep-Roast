import promptLibrarySnapshot from "@/data/prompt-library-snapshot.json";
import {
  normalizePromptLibrary,
  type CanvasPromptLibraryItem,
} from "@/components/ImageGen/canvas-prompt";
import { requestPublicHttpsBuffer } from "@/server/safe-http";

const PROMPT_SOURCES = [
  ["banana-prompt-quicker", "Banana Prompt Quicker"],
  ["davidwu-gpt-image2-prompts", "DavidWu GPT Image 2"],
  ["freestylefly-gpt-image-2", "Freestylefly GPT Image 2"],
  ["awesome-gpt-image", "Awesome GPT Image"],
  ["awesome-gpt4o-image-prompts", "Awesome GPT-4o"],
  ["youmind-gpt-image-2", "YouMind GPT Image 2"],
  ["youmind-nano-banana-pro", "YouMind Nano Banana Pro"],
] as const;

const SOURCE_BASE = "https://raw.githubusercontent.com/yukkcat/image-prompts/main/dist/sources";
const PROMPT_LIBRARY_CACHE_TTL_MS = 5 * 60 * 1000;
export const MAX_PROMPT_SOURCE_BYTES = 1024 * 1024;

let cachedSnapshotItems: CanvasPromptLibraryItem[] | null = null;
let cachedItems: CanvasPromptLibraryItem[] | null = null;
let cacheExpiresAt = 0;
let loadPromise: Promise<CanvasPromptLibraryItem[]> | null = null;

function getSnapshotItems(): CanvasPromptLibraryItem[] {
  if (!cachedSnapshotItems) {
    cachedSnapshotItems = normalizePromptLibrary(promptLibrarySnapshot);
  }
  return cachedSnapshotItems;
}

export function parsePromptLibrarySource(body: Buffer, maxBytes = MAX_PROMPT_SOURCE_BYTES): unknown[] {
  if (body.byteLength > maxBytes) throw new Error("提示词库上游响应过大");
  try {
    const value: unknown = JSON.parse(body.toString("utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function mergePromptLibraryItems(remoteItems: CanvasPromptLibraryItem[]) {
  const snapshotItems = getSnapshotItems();
  const seen = new Set<string>();
  return [...remoteItems, ...snapshotItems].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function fetchPromptLibraryItems() {
  const settled = await Promise.allSettled(PROMPT_SOURCES.map(async ([sourceId, sourceLabel]) => {
    const response = await requestPublicHttpsBuffer(`${SOURCE_BASE}/${sourceId}.json`, {
      headers: { Accept: "application/json" },
      timeoutMs: 3_000,
      maxBytes: MAX_PROMPT_SOURCE_BYTES,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`${sourceId}: ${response.status}`);
    }
    const raw = parsePromptLibrarySource(response.body);
    return normalizePromptLibrary(raw.map((item) => ({
      ...(item as object),
      sourceId,
      sourceLabel,
    })));
  }));
  return mergePromptLibraryItems(
    settled.flatMap((result) => result.status === "fulfilled" ? result.value : []),
  );
}

export async function getPromptLibraryItems(): Promise<CanvasPromptLibraryItem[]> {
  const now = Date.now();
  if (cachedItems && cacheExpiresAt > now) return cachedItems;
  if (!loadPromise) {
    loadPromise = fetchPromptLibraryItems()
      .then((items) => {
        cachedItems = items;
        cacheExpiresAt = Date.now() + PROMPT_LIBRARY_CACHE_TTL_MS;
        return items;
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}
