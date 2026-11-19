export type CanvasPromptReference = {
  id: string;
  label: string;
  title: string;
  kind: "image" | "text";
  previewUrl?: string;
  imageUrl?: string;
  text?: string;
};

export type CanvasPromptToken =
  | { type: "text"; value: string }
  | { type: "reference"; value: string; reference: CanvasPromptReference };

export const PROMPT_CONTENT_CATEGORIES = [
  "海报排版", "UI 与产品", "电商商业", "摄影写实", "人物角色", "插画艺术",
  "信息图表", "品牌社交", "游戏故事", "建筑空间", "生活学习", "其他",
] as const;
export type PromptContentCategory = (typeof PROMPT_CONTENT_CATEGORIES)[number];
export type PromptCategoryCounts = Partial<Record<PromptContentCategory, number>> & Record<string, number | undefined>;
export type CanvasPromptLibraryItem = {
  id: string; label: string; title: string; prompt: string; description: string;
  coverUrl?: string; tags: string[]; category: PromptContentCategory; sourceId: string;
  sourceLabel: string; sourceUrl?: string;
};
export type CanvasPromptLibraryResponse = {
  items: CanvasPromptLibraryItem[]; categories: PromptContentCategory[];
  categoryCounts: PromptCategoryCounts; tags: string[]; total: number; page: number;
  pageSize: number; hasMore: boolean;
};

export function syncPromptPanelValue(current: string, previousNodeValue: string, nextNodeValue: string) {
  return current === previousNodeValue ? nextNodeValue : current;
}

const categoryRules: Array<{ category: PromptContentCategory; hints: string[] }> = [
  { category: "海报排版", hints: ["海报", "poster", "封面", "typography", "banner", "flyer"] },
  { category: "UI 与产品", hints: ["界面", "ui", "interface", "网页", "app", "dashboard", "原型", "landing page"] },
  { category: "电商商业", hints: ["电商", "产品摄影", "商业摄影", "商品主图", "ecommerce", "product photography", "包装"] },
  { category: "摄影写实", hints: ["摄影", "写实", "photograph", "photorealistic", "cinematic", "胶片"] },
  { category: "人物角色", hints: ["人物", "人像", "角色", "portrait", "character", "avatar", "fashion"] },
  { category: "信息图表", hints: ["信息图", "infographic", "图表", "流程图", "思维导图", "数据可视化"] },
  { category: "插画艺术", hints: ["插画", "漫画", "动漫", "illustration", "concept art", "艺术", "3d渲染"] },
  { category: "品牌社交", hints: ["品牌", "logo", "社交媒体", "营销", "brand", "social media"] },
  { category: "游戏故事", hints: ["游戏", "故事", "分镜", "storyboard", "game asset", "世界观"] },
  { category: "建筑空间", hints: ["建筑", "室内", "空间设计", "architecture", "interior"] },
  { category: "生活学习", hints: ["学习", "教育", "美食", "旅行", "生活方式", "recipe", "travel"] },
];

function normalized(value: string) { return value.trim().toLowerCase(); }
export function classifyPromptCategory(input: { title?: string; prompt?: string; description?: string; tags?: readonly string[] }): PromptContentCategory {
  const text = [input.title, input.prompt, input.description, ...(input.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
  let winner: PromptContentCategory = "其他";
  let score = 0;
  for (const rule of categoryRules) {
    const current = rule.hints.reduce((sum, hint) => sum + (text.includes(hint.toLowerCase()) ? 1 : 0), 0);
    if (current > score) { score = current; winner = rule.category; }
  }
  return winner;
}

export function sanitizePromptTags(tags: string[]) {
  const seen = new Set<string>();
  return tags.map(tag => tag.trim()).filter(tag => {
    const key = normalized(tag);
    if (!key || seen.has(key) || /^@|gpt-?image|nano-?banana|featured|official|unknown/i.test(key)) return false;
    seen.add(key); return true;
  });
}

export function normalizePromptLibrary(value: unknown): CanvasPromptLibraryItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
    if (!title || !prompt) return [];
    const sourceId = typeof record.sourceId === "string" && record.sourceId.trim() ? record.sourceId.trim() : "snapshot";
    const sourceLabel = typeof record.sourceLabel === "string" && record.sourceLabel.trim() ? record.sourceLabel.trim() : sourceId;
    const tags = sanitizePromptTags(Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : []);
    return [{
      id: typeof record.id === "string" && record.id.trim() ? record.id : `${sourceId}:${index}:${title}`,
      label: title, title, prompt,
      description: typeof record.description === "string" ? record.description.trim() : "",
      coverUrl: typeof record.coverUrl === "string" ? record.coverUrl : undefined,
      tags, category: classifyPromptCategory({ title, prompt, description: typeof record.description === "string" ? record.description : "", tags }),
      sourceId, sourceLabel, sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : undefined,
    }];
  });
}

export function filterPromptLibrary(items: CanvasPromptLibraryItem[], options: { keyword?: string; category?: string; tag?: string } = {}) {
  const keyword = normalized(options.keyword ?? "");
  return items.filter(item => {
    if (options.category && options.category !== "全部" && item.category !== options.category) return false;
    if (options.tag && !item.tags.includes(options.tag)) return false;
    return !keyword || [item.title, item.prompt, item.description, item.category, item.sourceLabel, ...item.tags].join(" ").toLowerCase().includes(keyword);
  });
}

export type CanvasPromptLibraryRequest = { keyword?: string; category?: string; tag?: string; page?: number; pageSize?: number; signal?: AbortSignal };
export async function fetchCanvasPromptLibrary(options: CanvasPromptLibraryRequest = {}): Promise<CanvasPromptLibraryResponse> {
  const query = new URLSearchParams({ page: String(Math.max(1, options.page ?? 1)), pageSize: String(Math.max(1, options.pageSize ?? 20)) });
  if (options.keyword?.trim()) query.set("keyword", options.keyword.trim());
  if (options.category && options.category !== "全部") query.set("category", options.category);
  if (options.tag) query.set("tag", options.tag);
  const response = await fetch(`/api/prompt-library?${query}`, { signal: options.signal, cache: "no-store" });
  if (!response.ok) throw new Error("提示词库加载失败");
  const payload = await response.json() as Partial<CanvasPromptLibraryResponse> & { items?: unknown };
  const items = normalizePromptLibrary(payload.items);
  const categories = Array.isArray(payload.categories) ? payload.categories.filter((item): item is PromptContentCategory => typeof item === "string" && PROMPT_CONTENT_CATEGORIES.includes(item as PromptContentCategory)) : [];
  return {
    items, categories: categories.length ? categories : PROMPT_CONTENT_CATEGORIES.filter(category => items.some(item => item.category === category)),
    categoryCounts: payload.categoryCounts && typeof payload.categoryCounts === "object" ? payload.categoryCounts : Object.fromEntries(PROMPT_CONTENT_CATEGORIES.map(category => [category, items.filter(item => item.category === category).length])),
    tags: Array.isArray(payload.tags) ? payload.tags.filter((item): item is string => typeof item === "string") : [...new Set(items.flatMap(item => item.tags))],
    total: typeof payload.total === "number" ? payload.total : items.length,
    page: typeof payload.page === "number" ? payload.page : Math.max(1, options.page ?? 1),
    pageSize: typeof payload.pageSize === "number" ? payload.pageSize : Math.max(1, options.pageSize ?? 20),
    hasMore: Boolean(payload.hasMore),
  };
}

export function parsePromptReferences(value: string, references: CanvasPromptReference[]): CanvasPromptToken[] {
  const active = references.filter(reference => reference.label.trim()).sort((a, b) => b.label.length - a.label.length);
  if (!active.length || !value) return value ? [{ type: "text", value }] : [];
  const labels = active.map(reference => escapeRegExp(reference.label));
  const byLabel = new Map(active.map(reference => [reference.label, reference]));
  const pattern = new RegExp("(" + labels.join("|") + ")", "g");
  const tokens: CanvasPromptToken[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? -1;
    if (index < 0) continue;
    if (index > lastIndex) tokens.push({ type: "text", value: value.slice(lastIndex, index) });
    const label = match[0];
    const reference = byLabel.get(label);
    if (reference) tokens.push({ type: "reference", value: label, reference });
    else tokens.push({ type: "text", value: label });
    lastIndex = index + label.length;
  }
  if (lastIndex < value.length) tokens.push({ type: "text", value: value.slice(lastIndex) });
  return tokens;
}

export function insertPromptReference(value: string, reference: CanvasPromptReference): string {
  const base = value.trimEnd();
  return base + (base ? " " : "") + reference.label + " ";
}

export function removePromptReference(value: string, reference: CanvasPromptReference): string {
  const escaped = escapeRegExp(reference.label);
  return value.replace(new RegExp("(?:^|\\s)" + escaped + "(?=\\s|$)", "g"), " ").replace(/ {2,}/g, " ").trim();
}

export function serializePromptReferences(value: string, references: CanvasPromptReference[]): string {
  return parsePromptReferences(value, references).map(token => token.value).join("");
}

export function resolvePromptTextReferences(value: string, references: CanvasPromptReference[]): string {
  return references
    .filter(reference => reference.kind === "text")
    .sort((left, right) => right.label.length - left.label.length)
    .reduce((resolved, reference) => resolved.replace(
      new RegExp(escapeRegExp(reference.label), "g"),
      reference.text ?? reference.title,
    ), value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
}
