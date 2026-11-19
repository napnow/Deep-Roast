/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import type { ImageRecord } from "@/types";

export type CanvasAssetPanelProps = {
  images: ImageRecord[];
  canvasImageIds: Set<string>;
  onAdd: (image: ImageRecord) => void;
  onPreview: (image: ImageRecord) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  onRetry?: () => void;
};

type Filter = "all" | "recent" | "versions";

export default function CanvasAssetPanel({ images, canvasImageIds, onAdd, onPreview, hasMore = false, loadingMore = false, error = null, onLoadMore, onRetry }: CanvasAssetPanelProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("recent");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return images.filter(image => {
      if (filter === "versions" && !image.versionGroupId) return false;
      if (normalized && !image.prompt.toLowerCase().includes(normalized) && !image.model.toLowerCase().includes(normalized)) return false;
      return true;
    }).sort((a, b) => {
      if (filter === "recent") return b.createdAt.localeCompare(a.createdAt);
      return a.prompt.localeCompare(b.prompt, "zh-CN");
    });
  }, [filter, images, query]);

  return (
    <aside className="canvas-asset-panel" aria-label="作品资产">
      <div className="canvas-asset-panel__heading">
        <div><span className="canvas-asset-panel__eyebrow">资产库</span><h1>把作品带进画布</h1></div>
        <span className="canvas-asset-panel__count">{images.length}{hasMore ? "+" : ""}</span>
      </div>
      <search className="canvas-asset-panel__search"><label><span className="sr-only">搜索作品</span><input name="asset-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索提示词或模型" type="search" /></label></search>
      <div className="canvas-asset-panel__filters" aria-label="作品筛选">
        {([["recent", "最近"], ["all", "全部"], ["versions", "版本"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      <div className="canvas-asset-panel__list">
        {filtered.map(image => {
          const added = canvasImageIds.has(image.id);
          return <article key={image.id} className={`canvas-asset-card${added ? " is-added" : ""}`}>
            <button type="button" className="canvas-asset-card__image" onClick={() => onPreview(image)} aria-label={`预览：${image.prompt || "未命名作品"}`}>
              {image.thumbUrl || image.imageUrl ? <><img src={image.thumbUrl || image.imageUrl} alt="" loading="lazy" /></> : <span>无预览</span>}
            </button>
            <div className="canvas-asset-card__body"><strong title={image.prompt}>{image.prompt || "未命名作品"}</strong><span>{image.size} · {image.model}</span><button type="button" onClick={() => onAdd(image)} disabled={added}>{added ? "已在画布" : "加入画布"}</button></div>
          </article>;
        })}
        {!filtered.length && !error && <div className="canvas-asset-panel__empty">没有匹配的作品<br /><small>先生成一张图片，再把它加入画布</small></div>}
        {error && <div className="canvas-asset-panel__error" role="alert"><span>{error}</span>{onRetry && <button type="button" onClick={onRetry}>重试</button>}</div>}
        {hasMore && onLoadMore && <button type="button" className="canvas-asset-panel__more" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? "正在加载…" : "加载更多作品"}</button>}
      </div>
    </aside>
  );
}
