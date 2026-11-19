import { requireActiveUser } from "@/server/auth";
import { handleRoute } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { filterPromptLibrary, PROMPT_CONTENT_CATEGORIES, type PromptContentCategory } from "@/components/ImageGen/canvas-prompt";
import { getPromptLibraryItems } from "@/server/services/prompt-library";

export const GET = handleRoute(async (request: Request) => {
  const user = await requireActiveUser(request);
  await enforceRateLimit("prompt-library", user.userId, 30, 60);
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(40, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));
  const keyword = url.searchParams.get("keyword") || "";
  const category = url.searchParams.get("category") || "全部";
  const tag = url.searchParams.get("tag") || "";

  const items = await getPromptLibraryItems();
  if (!items.length) return Response.json({ error: "提示词库暂时不可用" }, { status: 503 });

  const categoryCounts = Object.fromEntries(PROMPT_CONTENT_CATEGORIES.map(category => [
    category,
    items.filter(item => item.category === category).length,
  ])) as Record<PromptContentCategory, number>;
  const categories = PROMPT_CONTENT_CATEGORIES.filter(category => categoryCounts[category] > 0);
  const categoryItems = filterPromptLibrary(items, { keyword, category });
  const filteredItems = filterPromptLibrary(categoryItems, { tag });
  const tagCounts = new Map<string, number>();
  for (const item of categoryItems) {
    for (const promptTag of item.tags) tagCounts.set(promptTag, (tagCounts.get(promptTag) || 0) + 1);
  }
  const tags = Array.from(tagCounts)
    .sort(([leftTag, leftCount], [rightTag, rightCount]) => rightCount - leftCount || leftTag.localeCompare(rightTag, "zh-CN"))
    .map(([promptTag]) => promptTag);
  const start = (page - 1) * pageSize;
  const pageItems = filteredItems.slice(start, start + pageSize);
  return Response.json({
    items: pageItems,
    categories,
    categoryCounts,
    tags,
    total: filteredItems.length,
    page,
    pageSize,
    hasMore: start + pageItems.length < filteredItems.length,
  }, {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
  });
});
