import { requireActiveUser } from "@/server/auth";
import { handleRoute } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { filterWearLibrary, WEAR_KINDS, type WearKind } from "@/components/ImageGen/wear-library";
import { getWearLibraryItems } from "@/server/services/wear-library";

export const GET = handleRoute(async (request: Request) => {
  const user = await requireActiveUser(request);
  await enforceRateLimit("wear-library", user.userId, 60, 60);
  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind") || "outfit";
  const kind: WearKind = WEAR_KINDS.includes(kindParam as WearKind) ? (kindParam as WearKind) : "outfit";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(120, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "48", 10) || 48));
  const category = url.searchParams.get("category") || "全部";
  const keyword = url.searchParams.get("keyword") || "";

  const all = await getWearLibraryItems();
  const ofKind = filterWearLibrary(all, { kind });
  const categories = [...new Set(ofKind.map((item) => item.category))];
  const filtered = filterWearLibrary(ofKind, { category, keyword });
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  return Response.json(
    {
      items,
      categories,
      total: filtered.length,
      page,
      pageSize,
      hasMore: start + items.length < filtered.length,
    },
    {
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
});
