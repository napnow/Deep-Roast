"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCanvasPromptLibrary,
  type CanvasPromptLibraryItem,
  type CanvasPromptLibraryResponse,
  type PromptCategoryCounts,
  type PromptContentCategory,
} from "./canvas-prompt";

const pageCache = new Map<string, CanvasPromptLibraryResponse>();

type PromptLibraryOptions = {
  keyword?: string;
  category?: string;
  tag?: string;
  pageSize?: number;
  enabled?: boolean;
};

function pageKey(filterKey: string, page: number, pageSize: number) {
  return `${filterKey}\u0000${page}\u0000${pageSize}`;
}

function mergeItems(current: CanvasPromptLibraryItem[], incoming: CanvasPromptLibraryItem[]) {
  const seen = new Set(current.map(item => item.id));
  return [...current, ...incoming.filter(item => !seen.has(item.id))];
}

export function useCanvasPromptLibrary(options: PromptLibraryOptions = {}) {
  const enabled = options.enabled ?? true;
  const pageSize = options.pageSize ?? 20;
  const category = options.category ?? "全部";
  const tag = options.tag ?? "";
  const keyword = options.keyword ?? "";
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
  const filterKey = `${debouncedKeyword.trim()}\u0000${category}\u0000${tag}`;
  const [items, setItems] = useState<CanvasPromptLibraryItem[]>([]);
  const [categories, setCategories] = useState<PromptContentCategory[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<PromptCategoryCounts>({});
  const [tags, setTags] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeController = useRef<AbortController | null>(null);
  const activeFilterKey = useRef(filterKey);

  useEffect(() => {
    const normalized = keyword.trimStart();
    if (!normalized.trim()) {
      setDebouncedKeyword("");
      return;
    }
    const timer = setTimeout(() => setDebouncedKeyword(normalized), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const applyFirstPage = useCallback((response: CanvasPromptLibraryResponse, nextFilterKey: string) => {
    if (activeFilterKey.current !== nextFilterKey) return;
    setItems(response.items);
    setCategories(response.categories);
    setCategoryCounts(response.categoryCounts);
    setTags(response.tags);
    setTotal(response.total);
    setPage(response.page);
    setHasMore(response.hasMore);
  }, []);

  const loadFirstPage = useCallback(async (force = false) => {
    if (!enabled) return;
    const nextFilterKey = filterKey;
    const cacheKey = pageKey(nextFilterKey, 1, pageSize);
    activeController.current?.abort();
    activeController.current = new AbortController();
    activeFilterKey.current = nextFilterKey;
    setError(null);
    setLoading(true);
    setLoadingMore(false);

    if (!force) {
      const cached = pageCache.get(cacheKey);
      if (cached) {
        applyFirstPage(cached, nextFilterKey);
        setLoading(false);
        return;
      }
    }

    setItems([]);
    setTotal(0);
    setPage(0);
    setHasMore(false);
    try {
      const response = await fetchCanvasPromptLibrary({
        keyword: debouncedKeyword,
        category,
        tag,
        page: 1,
        pageSize,
        signal: activeController.current.signal,
      });
      pageCache.set(cacheKey, response);
      applyFirstPage(response, nextFilterKey);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (activeFilterKey.current === nextFilterKey) {
        setError(cause instanceof Error ? cause.message : "提示词库加载失败");
      }
    } finally {
      if (activeFilterKey.current === nextFilterKey) setLoading(false);
    }
  }, [applyFirstPage, category, debouncedKeyword, enabled, filterKey, pageSize, tag]);

  useEffect(() => {
    if (!enabled) {
      activeController.current?.abort();
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      return;
    }
    void loadFirstPage();
    return () => activeController.current?.abort();
  }, [enabled, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!enabled || loading || loadingMore || !hasMore) return;
    const requestedFilterKey = filterKey;
    const nextPage = page + 1;
    const cacheKey = pageKey(requestedFilterKey, nextPage, pageSize);
    const cached = pageCache.get(cacheKey);
    setLoadingMore(true);
    setError(null);
    try {
      const response = cached ?? await fetchCanvasPromptLibrary({
        keyword: debouncedKeyword,
        category,
        tag,
        page: nextPage,
        pageSize,
        signal: activeController.current?.signal,
      });
      if (activeFilterKey.current !== requestedFilterKey) return;
      if (!cached) pageCache.set(cacheKey, response);
      setItems(current => mergeItems(current, response.items));
      setCategories(response.categories);
      setCategoryCounts(response.categoryCounts);
      setTags(response.tags);
      setTotal(response.total);
      setPage(response.page);
      setHasMore(response.hasMore);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (activeFilterKey.current === requestedFilterKey) {
        setError(cause instanceof Error ? cause.message : "更多提示词加载失败");
      }
    } finally {
      if (activeFilterKey.current === requestedFilterKey) setLoadingMore(false);
    }
  }, [category, debouncedKeyword, enabled, filterKey, hasMore, loading, loadingMore, page, pageSize, tag]);

  const reload = useCallback(async () => {
    for (const key of pageCache.keys()) {
      if (key.startsWith(`${filterKey}\u0000`)) pageCache.delete(key);
    }
    await loadFirstPage(true);
  }, [filterKey, loadFirstPage]);

  return {
    items,
    total,
    categories,
    categoryCounts,
    tags,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    reload,
  } satisfies {
    items: CanvasPromptLibraryItem[];
    total: number;
    categories: PromptContentCategory[];
    categoryCounts: PromptCategoryCounts;
    tags: string[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => Promise<void>;
    reload: () => Promise<void>;
  };
}
