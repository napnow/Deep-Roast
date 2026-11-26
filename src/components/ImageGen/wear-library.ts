// 服装 / 姿态 / 模特光影 素材库：类型、归一化、筛选、前端请求

export const WEAR_KINDS = ["outfit", "pose", "portrait"] as const;
export type WearKind = (typeof WEAR_KINDS)[number];
export const WEAR_KIND_LABELS: Record<WearKind, string> = {
  outfit: "服装参考",
  pose: "姿势参考",
  portrait: "场景与光影",
};
export const WEAR_KIND_SHORT: Record<WearKind, string> = {
  outfit: "服装",
  pose: "姿势",
  portrait: "光影",
};

export type WearSource = { label: string; url?: string; license?: string; author?: string };

export type WearLibraryItem = {
  id: string;
  kind: WearKind;
  title: string;
  /** 插入到提示词里的中文片段 */
  prompt: string;
  promptEn?: string;
  category: string;
  tags: string[];
  thumbUrl?: string;
  imageUrl?: string;
  source?: WearSource;
};

export type WearLibraryResponse = {
  items: WearLibraryItem[];
  categories: string[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeWearLibrary(value: unknown): WearLibraryItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    const kind = str(r.kind) as WearKind;
    const title = str(r.title);
    const prompt = str(r.prompt);
    if (!WEAR_KINDS.includes(kind) || !title || !prompt) return [];
    const id = str(r.id) || `${kind}:${index}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const src = r.source && typeof r.source === "object" ? (r.source as Record<string, unknown>) : null;
    return [
      {
        id,
        kind,
        title,
        prompt,
        promptEn: str(r.promptEn) || undefined,
        category: str(r.category) || "其他",
        tags: Array.isArray(r.tags) ? r.tags.map(str).filter(Boolean) : [],
        thumbUrl: str(r.thumbUrl) || undefined,
        imageUrl: str(r.imageUrl) || undefined,
        source: src
          ? {
              label: str(src.label) || "未知来源",
              url: str(src.url) || undefined,
              license: str(src.license) || undefined,
              author: str(src.author) || undefined,
            }
          : undefined,
      },
    ];
  });
}

export function filterWearLibrary(
  items: WearLibraryItem[],
  options: { kind?: string; category?: string; keyword?: string } = {},
) {
  const keyword = (options.keyword ?? "").trim().toLowerCase();
  return items.filter((item) => {
    if (options.kind && item.kind !== options.kind) return false;
    if (options.category && options.category !== "全部" && item.category !== options.category) return false;
    return (
      !keyword ||
      [item.title, item.prompt, item.promptEn, item.category, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  });
}

/** 把素材片段追加到现有提示词，避免重复 */
export function appendWearPrompt(current: string, item: WearLibraryItem) {
  const base = current.trim();
  if (base.includes(item.prompt)) return current;
  return base ? `${base}，${item.prompt}` : item.prompt;
}

export async function fetchWearLibrary(options: {
  kind: WearKind;
  category?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<WearLibraryResponse> {
  const query = new URLSearchParams({
    kind: options.kind,
    page: String(options.page ?? 1),
    pageSize: String(options.pageSize ?? 24),
  });
  if (options.category && options.category !== "全部") query.set("category", options.category);
  if (options.keyword?.trim()) query.set("keyword", options.keyword.trim());
  const response = await fetch(`/api/wear-library?${query}`, {
    signal: options.signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("素材库加载失败");
  const payload = (await response.json()) as Partial<WearLibraryResponse> & { items?: unknown };
  return {
    items: normalizeWearLibrary(payload.items),
    categories: Array.isArray(payload.categories)
      ? payload.categories.filter((c): c is string => typeof c === "string")
      : [],
    total: payload.total ?? 0,
    page: payload.page ?? 1,
    pageSize: payload.pageSize ?? 24,
    hasMore: Boolean(payload.hasMore),
  };
}
