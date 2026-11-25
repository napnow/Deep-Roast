"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import AppShell from "@/components/Workspace/AppShell";
import InfiniteImageCanvas from "@/components/ImageGen/InfiniteImageCanvas";
import CanvasAssetPanel from "@/components/ImageGen/CanvasAssetPanel";
import ImagePreviewModal from "@/components/ImageGen/ImagePreviewModal";
import { AppIcon } from "@/components/ui/icons";
import { ApiError, apiJson } from "@/lib/client-api";
import { settleCanvasVariantRequests, type CanvasGenerateContext } from "@/lib/canvas-generation";
import type { CanvasPromptPanelSettings } from "@/components/ImageGen/CanvasPromptPanel";
import { resolvePromptTextReferences, type CanvasPromptReference } from "@/components/ImageGen/canvas-prompt";
import { createImageContinuationDraft } from "@/lib/image-continuation";
import { useDeepRoastStore } from "@/lib/store";
import type { ImageRecord } from "@/types";

const HISTORY_PAGE_SIZE = 50;

function encodeCanvasBody(value: unknown): { body: string } {
  return { body: JSON.stringify(value) };
}


export default function CanvasStudioPage() {
  const router = useRouter();
  const { user } = useAuth();
  const configuredImageModels = useDeepRoastStore(state => state.imageModels);
  const selectedImageModel = useDeepRoastStore(state => state.selectedImageModel);
  const defaultImageModel = useDeepRoastStore(state => state.config.imageModel);
  const credits = useDeepRoastStore(state => state.credits);
  const setImageToImageDraft = useDeepRoastStore(state => state.setImageToImageDraft);
  const setImageCreationMode = useDeepRoastStore(state => state.setImageCreationMode);
  const imageModels = useMemo(() => configuredImageModels.map(model => model.id), [configuredImageModels]);
  const canvasDefaultModel = imageModels.includes(selectedImageModel)
    ? selectedImageModel
    : imageModels.includes(defaultImageModel)
      ? defaultImageModel
      : imageModels[0] || defaultImageModel;
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyNextOffset, setHistoryNextOffset] = useState(0);
  const [canvasImageIds, setCanvasImageIds] = useState<string[]>([]);
  const [pendingAddIds, setPendingAddIds] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null);
  const [generationStatus, setGenerationStatus] = useState("");
  const [assetsOpen, setAssetsOpen] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setHistoryError(null);
    try {
      const page = await apiJson<ImageRecord[]>(`/api/image-history?limit=${HISTORY_PAGE_SIZE}&offset=0`, { cache: "no-store" });
      setImages(previous => [...new Map([...page, ...previous].map(image => [image.id, image])).values()]);
      setHistoryNextOffset(page.length);
      setHistoryHasMore(page.length === HISTORY_PAGE_SIZE);
    } catch (error) {
      setHistoryError(error instanceof ApiError ? error.message : "作品库加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const loadMoreHistory = useCallback(async () => {
    if (historyLoadingMore || !historyHasMore) return;
    setHistoryLoadingMore(true);
    setHistoryError(null);
    try {
      const page = await apiJson<ImageRecord[]>(`/api/image-history?limit=${HISTORY_PAGE_SIZE}&offset=${historyNextOffset}`, { cache: "no-store" });
      setImages(previous => [...new Map([...previous, ...page].map(image => [image.id, image])).values()]);
      setHistoryNextOffset(offset => offset + page.length);
      setHistoryHasMore(page.length === HISTORY_PAGE_SIZE);
    } catch (error) {
      setHistoryError(error instanceof ApiError ? error.message : "更多作品加载失败，请稍后重试。");
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [historyHasMore, historyLoadingMore, historyNextOffset]);

  const canvasIds = useMemo(() => new Set(canvasImageIds), [canvasImageIds]);
  const addImageToCanvas = useCallback((image: ImageRecord) => {
    setPendingAddIds(previous => previous.includes(image.id) ? previous : [...previous, image.id]);
  }, []);
  const handleCanvasImageIdsChange = useCallback((ids: string[]) => {
    setCanvasImageIds(ids);
    setPendingAddIds(previous => previous.filter(id => !ids.includes(id)));
  }, []);

  const handleGenerate = useCallback(async (nodeId: string, prompt: string, references: CanvasPromptReference[], settings: CanvasPromptPanelSettings, canvasTarget: ImageRecord | null, context: CanvasGenerateContext) => {
    const resolvedPrompt = resolvePromptTextReferences(prompt, references);
    const target = canvasTarget?.id === nodeId ? canvasTarget : images.find(image => image.id === nodeId);
    const referenceImages = references
      .filter(reference => reference.kind === "image" && reference.id !== nodeId)
      .map(reference => reference.imageUrl || reference.previewUrl)
      .filter((value): value is string => Boolean(value));
    if (!target) {
      setGenerationStatus(settings.count > 1 ? `正在生成 ${settings.count} 张图片…` : "正在生成图片…");
      try {
        const sourceReference = references.find(reference => reference.kind === "image" && reference.id !== nodeId);
        let results: ImageRecord[];
        if (sourceReference && (sourceReference.imageUrl || sourceReference.previewUrl)) {
          const response = await apiJson<{ images: ImageRecord[] }>(settings.count > 1 ? "/api/image-edit/batch" : "/api/image-edit", {
            method: "POST",
            headers: { "Idempotency-Key": crypto.randomUUID() },
            signal: context.signal,
            ...encodeCanvasBody(settings.count > 1 ? {
              mode: "reference",
              targetImage: sourceReference.imageUrl || sourceReference.previewUrl,
              targetIndex: 0,
              sourceImageId: sourceReference.id,
              referenceImages,
              prompt: resolvedPrompt,
              model: settings.model,
              size: settings.size,
              count: settings.count,
            } : {
              mode: "reference",
              targetImage: sourceReference.imageUrl || sourceReference.previewUrl,
              targetIndex: 0,
              sourceImageId: sourceReference.id,
              referenceImages,
              prompt: resolvedPrompt,
              model: settings.model,
              size: settings.size,
            }),
          });
          results = response.images ?? [];
        } else {
          const settled = await settleCanvasVariantRequests(settings.count, signal => apiJson<ImageRecord>("/api/image", {
            method: "POST",
            headers: { "Idempotency-Key": crypto.randomUUID() },
            signal,
            ...encodeCanvasBody({ prompt: resolvedPrompt, model: settings.model, size: settings.size }),
          }), context.signal);
          results = settled.values;
          if (!results.length) {
            throw settled.errors[0] instanceof Error
              ? settled.errors[0]
              : new Error("未生成图片");
          }
          setImages(previous => [...results.map(item => ({ ...item, createdAt: item.createdAt || new Date().toISOString() })), ...previous.filter(item => !results.some(result => result.id === item.id))]);
          setPendingAddIds(previous => [...new Set([...previous, ...results.map(result => result.id)])]);
          if (settled.errors.length) {
            setGenerationStatus(`已生成 ${results.length} 张图片，另有 ${settled.errors.length} 张失败。`);
            return results.map(result => result.id);
          }
        }
        if (!results.length) throw new Error("未生成图片");
        setImages(previous => [...results.map(item => ({ ...item, createdAt: item.createdAt || new Date().toISOString() })), ...previous.filter(item => !results.some(result => result.id === item.id))]);
        setPendingAddIds(previous => [...new Set([...previous, ...results.map(result => result.id)])]);
        setGenerationStatus(`已生成 ${results.length} 张图片，已连接到文本节点。`);
        return results.map(result => result.id);
      } catch (error) {
        if (context.signal.aborted) throw error;
        setGenerationStatus(error instanceof ApiError ? error.message : "生成失败，请稍后重试。");
        return [];
      }
    }
    const editBody = referenceImages.length
      ? {
          mode: "reference",
          targetImage: target.imageUrl,
          targetIndex: 0,
          sourceImageId: target.id,
          referenceImages,
          prompt: resolvedPrompt,
          model: settings.model,
          size: settings.size,
          count: settings.count,
        }
      : {
          mode: "per-image",
          items: [{ image: target.imageUrl, prompt: resolvedPrompt, sourceImageId: target.id, targetIndex: 0 }],
          prompt: resolvedPrompt,
          model: settings.model,
          size: settings.size,
          count: settings.count,
        };
    const endpoint = settings.count > 1 ? "/api/image-edit/batch" : "/api/image-edit";
    setGenerationStatus(settings.count > 1 ? `正在生成 ${settings.count} 张变体…` : "正在生成修改结果…");
    try {
      const result = await apiJson<{ images: ImageRecord[]; failed?: number; lastError?: string | null }>(endpoint, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        signal: context.signal,
        ...encodeCanvasBody(editBody),
      });
      const results = result.images ?? [];
      if (!results.length) throw new Error(result.lastError || "未生成图片");
      setImages(previous => [...results.map(item => ({ ...item, createdAt: item.createdAt || new Date().toISOString() })), ...previous.filter(item => !results.some(result => result.id === item.id))]);
      setPendingAddIds(previous => [...new Set([...previous, ...results.map(result => result.id)])]);
      setGenerationStatus(result.failed
        ? `已生成 ${results.length} 张，另有 ${result.failed} 张失败。`
        : `已生成 ${results.length} 张，可继续在画布中编辑。`);
      return results.map(result => result.id);
    } catch (error) {
      if (context.signal.aborted) throw error;
      setGenerationStatus(error instanceof ApiError ? error.message : "生成失败，请稍后重试。");
      return [];
    }
  }, [images]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiJson(`/api/image-history/${id}`, { method: "DELETE" });
      setImages(previous => previous.filter(image => image.id !== id));
      setCanvasImageIds(previous => previous.filter(imageId => imageId !== id));
      setPendingAddIds(previous => previous.filter(imageId => imageId !== id));
      window.dispatchEvent(new CustomEvent("deeproast:image-deleted", { detail: id }));
      setPreviewImage(null);
    } catch (error) {
      setGenerationStatus(error instanceof ApiError ? error.message : "删除失败，请稍后重试。");
    }
  }, []);

  if (!user) return null;

  const header = <header className="canvas-page-topbar">
    <div className="canvas-page-topbar__left">
      <button type="button" className="canvas-page-topbar__panel-toggle" onClick={() => setAssetsOpen(open => !open)} aria-label={assetsOpen ? "收起作品资产" : "展开作品资产"} aria-expanded={assetsOpen}>
        <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M14 9l-3 3 3 3" /></svg>
      </button>
      <button type="button" className="canvas-page-topbar__brand" onClick={() => router.push("/")} aria-label="返回深焙生图">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand-mark.png" alt="" width={28} height={28} className="canvas-brand-mark" draggable={false} />
        <strong>深焙</strong><span>Deep Roast</span>
      </button>
      <span className="canvas-page-topbar__divider" aria-hidden="true" />
      <span className="canvas-page-topbar__workspace">作品画布</span>
    </div>
    <div className="canvas-page-topbar__actions">
      <span className="canvas-topbar-credit" title="当前账户积分">
        <i aria-hidden="true" />
        <span>{user.role === "admin" ? "管理员" : `${credits.toLocaleString()} 积分`}</span>
      </span>
      <button
        type="button"
        className="canvas-topbar-icon-btn"
        onClick={() => {
          const nextDark = !document.documentElement.classList.contains("dark");
          document.documentElement.classList.toggle("dark", nextDark);
          window.localStorage.setItem("theme", nextDark ? "dark" : "light");
          const meta = document.querySelector('meta[name="theme-color"]');
          if (meta) meta.setAttribute("content", nextDark ? "#141210" : "#f8f7f4");
        }}
        title="切换深浅色主题"
        aria-label="切换深浅色主题"
      >
        <AppIcon name="sun" size={14} className="canvas-theme-icon canvas-theme-icon--sun" />
        <AppIcon name="moon" size={14} className="canvas-theme-icon canvas-theme-icon--moon" />
      </button>
      <button type="button" onClick={() => router.push("/")}>← 返回创作</button>
    </div>
  </header>;

  return <AppShell header={header}>
    <div className="canvas-page-shell">
      <div className={`canvas-page-main${assetsOpen ? "" : " is-assets-collapsed"}`}>
        {assetsOpen && <CanvasAssetPanel images={images} canvasImageIds={canvasIds} onAdd={addImageToCanvas} onPreview={setPreviewImage} hasMore={historyHasMore} loadingMore={historyLoadingMore} error={historyError} onLoadMore={() => void loadMoreHistory()} onRetry={() => void (images.length ? loadMoreHistory() : loadHistory())} />}
        <div className="infinite-image-canvas-wrap">
          {loading ? <div className="infinite-image-empty">正在加载作品库…</div> : <InfiniteImageCanvas accountId={user.id} images={images} onSelect={() => undefined} onPreview={setPreviewImage} onEdit={() => router.push("/")} autoAddImages={false} addImageIds={pendingAddIds} onCanvasImageIdsChange={handleCanvasImageIdsChange} onGenerate={handleGenerate} imageModels={imageModels} defaultImageModel={canvasDefaultModel} />}
          {generationStatus && <div className="canvas-page-generation-status" role="status" aria-live="polite">{generationStatus}</div>}
        </div>
      </div>
      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
        onContinueEditing={() => {
          if (previewImage?.imageUrl) {
            setImageToImageDraft(createImageContinuationDraft(previewImage));
            setImageCreationMode("edit");
          }
          router.push("/");
        }}
        onDelete={handleDelete}
      />
    </div>
  </AppShell>;
}
