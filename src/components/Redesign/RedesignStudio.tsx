"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import type { ImageRecord } from "@/types";
import { DEFAULT_IMAGE_MODEL_CREDIT_COST, IMAGE_STYLE_PRESETS } from "@/types";
import { useDeepRoastStore } from "@/lib/store";
import { useConfirm } from "@/components/ConfirmProvider";
import { AppIcon } from "@/components/ui/icons";
import { imageSizeLabel, normalizeImageSizeSelection } from "@/lib/custom-image-ratio";
import { isGeminiImageModel, isGptImageModel } from "@/lib/image-model-capabilities";
import { copyText } from "@/lib/browser-actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import { CustomPixelEditor, CustomRatioEditor } from "@/components/ImageGen/ImageRatioPicker";
import { resolveMobileComposerDrag } from "@/components/ImageGen/mobile-composer-state";
import { generationCost } from "@/lib/image-workspace";
import { canUseImageGeneration } from "@/lib/image-generation-access";
import { apiJson, ApiError } from "@/lib/client-api";
import {
  POLISH_PROMPT_CREDIT_COST,
  parsePromptPolishResponse,
  promptPolishError,
} from "@/lib/prompt-polish";
import { downloadImage, getSizeOptions, formatTime, thumbSrc } from "@/components/ImageGen/imageUtils";
import ImageGenStageIndicator from "@/components/ImageGen/ImageGenStageIndicator";
import Img2ImgPanel from "@/components/ImageGen/Img2ImgPanel";
import ReversePromptPanel from "@/components/ImageGen/ReversePromptPanel";
import type { ImageEditRequest } from "@/lib/image-edit-contract";
import { createImageContinuationDraft } from "@/lib/image-continuation";
import type { ImageCreationMode } from "@/lib/workspace-preferences";
import {
  clockLabel,
  dayLabel,
  groupImageBatches,
  sizeAspect,
  splitStylePrompt,
  type ImageBatch,
  type RedesignView,
} from "./redesign-ui";

const SUGGESTIONS: ReadonlyArray<{ category: string; prompt: string }> = [
  {
    category: "胶片叙事 · 16:9",
    prompt: "雨夜的老城区咖啡馆，玻璃上的水汽，暖黄灯光从里面透出来，35mm 胶片质感",
  },
  {
    category: "自然光影 · 4:3",
    prompt: "一只橘猫趴在旧书店木质窗台上晒太阳，尘埃在柔和逆光中浮游，浅景深",
  },
  {
    category: "商业静物 · 1:1",
    prompt: "极简编辑感产品摄影：磨砂琥珀玻璃香水瓶立于天然石材上，暖米色背景与利落树影",
  },
];

const MODE_LABEL: Record<ImageBatch["mode"], string> = { text: "文生图", edit: "图生图", unknown: "生图" };

function aspectStyle(size: string) {
  const { w, h } = sizeAspect(size);
  return { aspectRatio: `${w} / ${h}` };
}

function useElapsedSeconds(startedAt: number | null, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  if (!active || !startedAt) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

function useMobileKeyboardInset() {
  const [inset, setInset] = useState(0);
  const [visibleHeight, setVisibleHeight] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      if (!window.matchMedia("(max-width: 767px)").matches) {
        setInset(0);
        setVisibleHeight(0);
        return;
      }
      const raw = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setInset(raw > 80 ? raw : 0);
      setVisibleHeight(Math.round(vv.height));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return { keyboardInset: inset, visibleHeight };
}

export interface RedesignStudioProps {
  view: RedesignView;
  model: string;
  history: ImageRecord[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  generating: boolean;
  credits: number;
  isAdmin: boolean;
  onGenerate: (prompt: string, size: string, count?: number) => void;
  onStopGenerate: () => void;
  onRetryGenerate: () => void;
  onDeleteImage: (id: string) => void | Promise<void>;
  /** 图库批量删除：selected 只删勾选的图，version-group 删整个版本组；返回实际删除的 id */
  onBatchDeleteImages: (ids: string[], mode: "selected" | "version-group") => Promise<string[]>;
  onWalletClick: () => void;
  onEditImage: (request: ImageEditRequest, size: string) => void;
  onEditImageBatch: (request: ImageEditRequest, size: string, count: number) => void;
  /** 从图库「继续修改」时切回创作页 */
  onShowCreate: () => void;
}

export default function RedesignStudio({
  view,
  model,
  history,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  generating,
  credits,
  isAdmin,
  onGenerate,
  onStopGenerate,
  onRetryGenerate,
  onDeleteImage,
  onBatchDeleteImages,
  onWalletClick,
  onEditImage,
  onEditImageBatch,
  onShowCreate,
}: RedesignStudioProps) {
  const imageTask = useDeepRoastStore((state) => state.imageTask);
  const clearImageTask = useDeepRoastStore((state) => state.clearImageTask);
  const imageModels = useDeepRoastStore((state) => state.imageModels);
  const selectedImageModel = useDeepRoastStore((state) => state.selectedImageModel);
  const setSelectedImageModel = useDeepRoastStore((state) => state.setSelectedImageModel);
  const setTextToImageDraft = useDeepRoastStore((state) => state.setTextToImageDraft);
  const setImageToImageDraft = useDeepRoastStore((state) => state.setImageToImageDraft);
  const setImageCreationMode = useDeepRoastStore((state) => state.setImageCreationMode);

  const [preview, setPreview] = useState<ImageRecord | null>(null);
  const [mobileComposerExpanded, setMobileComposerExpanded] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "text" | "edit">("all");
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();
  const previewDownload = useActionFeedback(`${preview?.id || ""}:download`);
  const previewCopy = useActionFeedback(`${preview?.id || ""}:copy`);
  const cardDownload = useActionFeedback("rd-card-download");
  const [failedPreviewId, setFailedPreviewId] = useState<string | null>(null);
  const [previewRetry, setPreviewRetry] = useState(0);
  const previewFailed = Boolean(preview && failedPreviewId === preview.id);

  const galleryList = useMemo(() => {
    const q = query.trim();
    return history.filter((image) => {
      if (filter !== "all" && (image.sourceMode ?? "unknown") !== filter) return false;
      return !q || image.prompt.includes(q) || image.model.includes(q);
    });
  }, [history, query, filter]);
  const selectedImages = history.filter((image) => selectedIds.has(image.id));
  const selectedGroupIds = new Set(
    selectedImages.map((image) => image.versionGroupId).filter((id): id is string => Boolean(id)),
  );
  const selectedGroupId = selectedGroupIds.size === 1 ? [...selectedGroupIds][0]! : null;
  const selectedGroupSize = selectedGroupId
    ? history.filter((image) => image.versionGroupId === selectedGroupId).length
    : 0;
  const allPicked = galleryList.length > 0 && galleryList.every((image) => selectedIds.has(image.id));
  const armTimer = useRef<number | undefined>(undefined);

  const isGenerating = imageTask.status === "generating";
  const elapsed = useElapsedSeconds(imageTask.startedAt, isGenerating);

  const days = useMemo(() => {
    const out: Array<{ label: string; batches: ImageBatch[]; count: number }> = [];
    for (const batch of groupImageBatches(history)) {
      const label = dayLabel(batch.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) {
        last.batches.push(batch);
        last.count += batch.images.length;
      } else out.push({ label, batches: [batch], count: batch.images.length });
    }
    return out;
  }, [history]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview]);

  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  function armDelete(id: string) {
    window.clearTimeout(armTimer.current);
    if (armed === id) {
      setArmed(null);
      if (preview?.id === id) setPreview(null);
      void onDeleteImage(id);
      return;
    }
    setArmed(id);
    armTimer.current = window.setTimeout(() => setArmed(null), 2500);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  async function batchDelete(mode: "selected" | "version-group") {
    if (deleting) return;
    const group = mode === "version-group";
    if (group ? !selectedGroupId : !selectedImages.length) return;
    let totalGroupSize = selectedGroupSize;
    if (group && selectedGroupId && hasMore) {
      try {
        const res = await apiJson<{ count?: number }>(
          `/api/image-history/version-group/${encodeURIComponent(selectedGroupId)}`,
        );
        if (typeof res.count === "number" && res.count > totalGroupSize) {
          totalGroupSize = res.count;
        }
      } catch {
        /* 统计查询失败时回退为已加载数量提示 */
      }
    }
    const unloadedCount = Math.max(0, totalGroupSize - selectedGroupSize);
    const ok = await confirm({
      title: group ? "删除整个版本组" : "删除选中作品",
      message: group
        ? unloadedCount > 0
          ? `将删除该版本组的全部图片（共 ${totalGroupSize} 张，含未加载页面的 ${unloadedCount} 张），此操作不可撤销。`
          : hasMore
            ? `将删除该版本组的全部图片（当前已加载 ${totalGroupSize} 张，含同组未加载版本），此操作不可撤销。`
            : `将删除该版本组的全部图片（共 ${totalGroupSize} 张），此操作不可撤销。`
        : `将删除已选中的 ${selectedImages.length} 张图片，其他版本不会受影响。此操作不可撤销。`,
      confirmText: "确认删除",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const ids = group ? [selectedGroupId!] : selectedImages.map((image) => image.id);
      const deletedIds = await onBatchDeleteImages(ids, mode);
      if (preview && deletedIds.includes(preview.id)) setPreview(null);
      if (deletedIds.length) exitSelecting();
    } finally {
      setDeleting(false);
    }
  }

  async function deleteFromPreview(image: ImageRecord) {
    const ok = await confirm({ title: "删除图片", message: "确定删除这张图片？此操作不可撤销。", confirmText: "删除" });
    if (!ok) return;
    setPreview(null);
    await onDeleteImage(image.id);
  }

  function focusPrompt() {
    setMobileComposerExpanded(true);
    window.setTimeout(() => document.getElementById("rd-prompt")?.focus(), 40);
  }

  function continueEditing(image: ImageRecord) {
    if (!image.imageUrl) return;
    const currentModel = selectedImageModel || model;
    if (isGeminiImageModel(currentModel)) {
      const fallbackEdit = imageModels.find((item) => !isGeminiImageModel(item.id));
      if (fallbackEdit) setSelectedImageModel(fallbackEdit.id);
    }
    setImageToImageDraft(createImageContinuationDraft(image));
    setImageCreationMode("edit");
    setMobileComposerExpanded(true);
    setPreview(null);
    onShowCreate();
  }

  function reuse(batch: ImageBatch) {
    const parts = splitStylePrompt(batch.prompt);
    setTextToImageDraft({
      prompt: parts.prompt,
      stylePrompt: parts.stylePrompt,
      size: batch.size,
      count: Math.min(5, Math.max(1, batch.images.length)),
    });
    if (imageModels.some((item) => item.id === batch.model)) setSelectedImageModel(batch.model);
    focusPrompt();
  }

  function again(batch: ImageBatch) {
    if (generating) return;
    setMobileComposerExpanded(false);
    onGenerate(batch.prompt, batch.size, Math.min(5, Math.max(1, batch.images.length)));
  }

  function renderLoadMore() {
    if (!hasMore || !onLoadMore) return null;
    return (
      <div className="rd-more-wrap">
        <button
          type="button"
          className="rd-bb is-visible"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? "正在加载历史作品…" : "加载更多历史作品"}
        </button>
      </div>
    );
  }

  function renderCard(image: ImageRecord, inRow: boolean) {
    const picking = selecting && !inRow;
    const picked = picking && selectedIds.has(image.id);
    const open = () => (picking ? toggleSelected(image.id) : setPreview(image));
    return (
      <div
        key={image.id}
        className={`rd-card${inRow ? " is-row" : ""}${picking ? " is-picking" : ""}${picked ? " is-picked" : ""}`}
        style={inRow ? aspectStyle(image.size) : undefined}
        role="button"
        tabIndex={0}
        aria-label={`${picking ? "选择作品" : "查看大图"}：${image.prompt || "作品"}`}
        aria-pressed={picking ? picked : undefined}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === "Enter" || (picking && event.key === " ")) {
            event.preventDefault();
            open();
          }
        }}
      >
        <img src={thumbSrc(image)} alt={image.prompt} loading="lazy" draggable={false} />
        {picking && (
          <span className="rd-pick" aria-hidden="true">
            {picked ? <AppIcon name="check" size={13} strokeWidth={2.4} /> : null}
          </span>
        )}
        {!picking && (
          <div className="rd-quick" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => continueEditing(image)} title="继续修改" aria-label="继续修改">
              <AppIcon name="edit" size={14} />
            </button>
            <button
              type="button"
              title="下载原图"
              aria-label="下载原图"
              disabled={cardDownload.status === "pending"}
              aria-busy={cardDownload.status === "pending"}
              onClick={() => void cardDownload.run((signal) => downloadImage(image, signal), "已发起下载", "下载未完成，请检查网络后重试。")}
            >
              <AppIcon name="download" size={14} />
            </button>
            <button
              type="button"
              className={armed === image.id ? "is-armed" : ""}
              onClick={() => armDelete(image.id)}
              title={armed === image.id ? "再点一次确认删除" : "删除"}
              aria-label={armed === image.id ? "确认删除" : "删除"}
            >
              {armed === image.id ? "确认删除" : <AppIcon name="trash" size={14} />}
            </button>
          </div>
        )}
        {!inRow && (
          <div className="rd-cap">
            <p>{splitStylePrompt(image.prompt).prompt}</p>
            <span>{sizeAspect(image.size).label} · {clockLabel(image.createdAt)}</span>
          </div>
        )}
      </div>
    );
  }

  function renderLive() {
    const request = imageTask.request;
    if (!isGenerating || !request) return null;
    const parts = splitStylePrompt(request.prompt);
    const count = Math.min(5, Math.max(1, request.count || 1));
    return (
      <section className="rd-batch is-live" aria-live="polite">
        <header className="rd-bh">
          <p className="rd-bp">{parts.prompt}</p>
          <div className="rd-bm">
            <span className="rd-tag">{request.mode === "edit" ? "图生图" : "文生图"}</span>
            <span>{sizeAspect(request.size).label}</span>
            <span>× {count}</span>
            {parts.styleLabel && <span>{parts.styleLabel}</span>}
            <span className="rd-live">焙制中 · {formatTime(elapsed)}</span>
            <span className="rd-grow" />
            <button type="button" className="rd-bb is-visible" onClick={onStopGenerate}>停止生成</button>
          </div>
        </header>
        <div className="rd-brow">
          {Array.from({ length: count }, (_, index) => (
            <div key={index} className="rd-card is-row is-dev" style={aspectStyle(request.size)}>
              <div className="rd-orb"><ThinkingOrb state="working" size={64} /></div>
              {index === 0 && <ImageGenStageIndicator elapsedSeconds={elapsed} className="rd-stage" />}
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderError() {
    if (imageTask.status !== "error" || !imageTask.error) return null;
    const inProgress = imageTask.error.code === "IDEMPOTENCY_IN_PROGRESS";
    return (
      <section className="rd-error" role="alert">
        <div>
          <b>
            {imageTask.error.kind === "credits"
              ? "积分不足"
              : imageTask.error.kind === "network"
                ? "网络连接中断"
                : inProgress
                  ? "上一笔请求仍在生成中"
                  : "服务暂时没有完成生成"}
          </b>
          <p>
            {imageTask.error.kind === "credits"
              ? "查看余额后调整生成数量，描述和参数已保留。"
              : imageTask.error.kind === "network"
                ? "请先检查网络，描述和参数已保留，可返回修改或手动重试。"
                : inProgress
                  ? "原请求仍在后台处理，稍等几秒再点重试即可取回结果，不会重复扣费。"
                  : "可以稍后重试或返回调整参数，不会自动再次提交。"}
          </p>
          {imageTask.error.kind === "service" && !inProgress && imageTask.error.message && <p className="rd-err-msg">{imageTask.error.message}</p>}
        </div>
        {imageTask.error.kind === "credits" ? (
          <button type="button" className="rd-bb is-visible" onClick={onWalletClick}>去钱包</button>
        ) : (
          <button type="button" className="rd-bb is-visible" onClick={onRetryGenerate}>重试</button>
        )}
        <button type="button" className="rd-bb is-visible" onClick={() => { clearImageTask(); focusPrompt(); }}>返回修改</button>
        <button type="button" className="rd-x" onClick={clearImageTask} aria-label="关闭">
          <AppIcon name="close" size={14} />
        </button>
      </section>
    );
  }

  function renderCreate() {
    return (
      <>
        {renderError()}
        {renderLive()}
        {!days.length && !isGenerating ? (
          <div className="rd-empty">
            <h1>想画点什么？</h1>
            <p>
              输入画面构思即可显影成片
              <span className="rd-empty__sugg-hint">，也可以挑选下方灵感快速试拍</span>。
            </p>
            <div className="rd-sugg">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item.prompt}
                  type="button"
                  onClick={() => {
                    setTextToImageDraft({ prompt: item.prompt });
                    focusPrompt();
                  }}
                >
                  <span className="rd-sugg__tag">
                    <span>{item.category}</span>
                    <i aria-hidden="true">→</i>
                  </span>
                  <span className="rd-sugg__text">{item.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {days.map((day) => (
              <div key={day.label}>
                <div className="rd-day"><b>{day.label}</b><span>{day.batches.length} 批 · {day.count} 张</span></div>
                {day.batches.map((batch) => {
                  const parts = splitStylePrompt(batch.prompt);
                  return (
                    <section key={batch.key} className="rd-batch">
                      <header className="rd-bh">
                        <p className="rd-bp">{parts.prompt || "未命名作品"}</p>
                        <div className="rd-bm">
                          <span className="rd-tag">{MODE_LABEL[batch.mode]}</span>
                          <span>{batch.model}</span>
                          <span>{sizeAspect(batch.size).label}</span>
                          <span>× {batch.images.length}</span>
                          {parts.styleLabel && <span>{parts.styleLabel}</span>}
                          <span>{clockLabel(batch.createdAt)}</span>
                          <span className="rd-grow" />
                          <button type="button" className="rd-bb" onClick={() => reuse(batch)} title="把提示词和参数放回输入框">复用参数</button>
                          {batch.mode !== "edit" && (
                            <button type="button" className="rd-bb" onClick={() => again(batch)} disabled={generating}>再来一批</button>
                          )}
                        </div>
                      </header>
                      <div className="rd-brow">{batch.images.map((image) => renderCard(image, true))}</div>
                    </section>
                  );
                })}
              </div>
            ))}
            {renderLoadMore()}
          </>
        )}
      </>
    );
  }

  function renderGallery() {
    const list = galleryList;
    return (
      <>
        <div className="rd-gbar">
          <div className="rd-gbar__title">
            <h2>图库</h2>
            <span>{history.length}{hasMore ? "+" : ""} 张作品</span>
          </div>
          <span className="rd-grow" />
          <input className="rd-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索提示词或模型" aria-label="搜索作品" />
          <div className="rd-seg">
            {([["all", "全部"], ["text", "文生图"], ["edit", "图生图"]] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
          {!selecting && (
            <button type="button" className="rd-bb is-visible" disabled={!history.length} onClick={() => setSelecting(true)}>选择</button>
          )}
        </div>
        {selecting && (
          <div className="rd-selbar" role="toolbar" aria-label="批量操作">
            <span aria-live="polite">已选 <b>{selectedImages.length}</b> 张</span>
            <button type="button" className="rd-bb is-visible" disabled={!galleryList.length} onClick={() => setSelectedIds(allPicked ? new Set() : new Set(galleryList.map((image) => image.id)))}>
              {allPicked ? "取消全选" : "全选"}
            </button>
            <span className="rd-grow" />
            <button type="button" className="rd-bb is-visible is-danger" disabled={!selectedImages.length || deleting} onClick={() => void batchDelete("selected")}>删除选中</button>
            <button
              type="button"
              className="rd-bb is-visible is-danger"
              disabled={!selectedGroupId || deleting}
              title={
                selectedGroupId
                  ? hasMore
                    ? `当前已加载 ${selectedGroupSize} 张，点击确认整组总数`
                    : `共 ${selectedGroupSize} 张`
                  : "勾选同一版本组的图片后可用"
              }
              onClick={() => void batchDelete("version-group")}
            >
              删除版本组
            </button>
            <button type="button" className="rd-bb is-visible" onClick={exitSelecting}>完成</button>
          </div>
        )}
        {list.length ? (
          <>
            <div className="rd-grid">{list.map((image) => renderCard(image, false))}</div>
            {renderLoadMore()}
          </>
        ) : (
          <div className="rd-empty is-small"><p>没有符合条件的作品</p></div>
        )}
      </>
    );
  }

  return (
    <div className={`rd-studio is-${view}${view === "create" && !mobileComposerExpanded ? " is-composer-collapsed" : ""}`}>
      <div
        className="rd-stream"
        onClick={(event) => {
          if (!mobileComposerExpanded) return;
          const target = event.target as HTMLElement | null;
          if (target?.closest("button, a, input, textarea, [role='button'], .rd-error")) return;
          setMobileComposerExpanded(false);
        }}
      >
        <div className="rd-wrap">{view === "gallery" ? renderGallery() : renderCreate()}</div>
      </div>
      {view === "create" && (
        <RedesignComposer
          model={model}
          credits={credits}
          isAdmin={isAdmin}
          generating={generating}
          mobileExpanded={mobileComposerExpanded}
          onMobileExpandedChange={setMobileComposerExpanded}
          onGenerate={onGenerate}
          onWalletClick={onWalletClick}
          onStop={onStopGenerate}
          onEditImage={onEditImage}
          onEditImageBatch={onEditImageBatch}
        />
      )}
      {preview && (
        <div className="rd-lightbox" role="dialog" aria-modal="true" aria-label="作品大图" onClick={() => setPreview(null)}>
          <figure onClick={(event) => event.stopPropagation()}>
            {previewFailed ? (
              <div className="rd-lb-fail" role="status">
                <span>原图加载失败，请检查网络后重试。</span>
                <button type="button" className="rd-bb is-visible" onClick={() => { setFailedPreviewId(null); setPreviewRetry((value) => value + 1); }}>重新加载原图</button>
              </div>
            ) : (
              <img key={`${preview.id}:${previewRetry}`} src={preview.imageUrl} alt={preview.prompt} onError={() => setFailedPreviewId(preview.id)} />
            )}
            <figcaption>
              <p>{splitStylePrompt(preview.prompt).prompt}</p>
              <span>{preview.model} · {preview.size} · {dayLabel(preview.createdAt)} {clockLabel(preview.createdAt)}</span>
              <div>
                <button type="button" className="rd-bb is-visible" onClick={() => continueEditing(preview)}>
                  <AppIcon name="edit" size={13} />
                  继续修改
                </button>
                <button
                  type="button"
                  className="rd-bb is-visible"
                  disabled={previewDownload.status === "pending"}
                  aria-busy={previewDownload.status === "pending"}
                  onClick={() => void previewDownload.run((signal) => downloadImage(preview, signal), "已发起下载", "下载未完成，请检查网络后重试。")}
                >
                  <AppIcon name="download" size={13} />
                  {previewDownload.status === "pending" ? "准备下载…" : previewDownload.status === "success" ? "已发起下载" : "下载原图"}
                </button>
                <button
                  type="button"
                  className="rd-bb is-visible"
                  disabled={previewCopy.status === "pending"}
                  onClick={() => void previewCopy.run(() => copyText(preview.prompt), "提示词已复制")}
                >
                  <AppIcon name="copy" size={13} />
                  {previewCopy.status === "pending" ? "正在复制…" : previewCopy.status === "success" ? "已复制" : "复制提示词"}
                </button>
                <button type="button" className="rd-bb is-visible is-danger" onClick={() => void deleteFromPreview(preview)}>
                  <AppIcon name="trash" size={13} />
                  删除
                </button>
                <button type="button" className="rd-bb is-visible" onClick={() => setPreview(null)}>关闭</button>
              </div>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}

type PopKey = "mode" | "model" | "ratio" | "count" | "style";

const CREATION_MODES: ReadonlyArray<readonly [ImageCreationMode, string, string]> = [
  ["text", "文生图", "写一句描述，从零生成"],
  ["edit", "图生图", "放 1–5 张图，写修改要求"],
  ["reverse", "反推", "从一张图反推出提示词"],
];

interface ComposerProps {
  model: string;
  credits: number;
  isAdmin: boolean;
  generating: boolean;
  mobileExpanded: boolean;
  onMobileExpandedChange: (expanded: boolean) => void;
  onGenerate: (prompt: string, size: string, count?: number) => void;
  onWalletClick: () => void;
  onStop: () => void;
  onEditImage: (request: ImageEditRequest, size: string) => void;
  onEditImageBatch: (request: ImageEditRequest, size: string, count: number) => void;
}

function RedesignComposer({
  model,
  credits,
  isAdmin,
  generating,
  mobileExpanded,
  onMobileExpandedChange,
  onGenerate,
  onWalletClick,
  onStop,
  onEditImage,
  onEditImageBatch,
}: ComposerProps) {
  const draft = useDeepRoastStore((state) => state.textToImageDraft);
  const setDraft = useDeepRoastStore((state) => state.setTextToImageDraft);
  const commitPolishedPrompt = useDeepRoastStore((state) => state.commitPolishedPrompt);
  const setCredits = useDeepRoastStore((state) => state.setCredits);
  const config = useDeepRoastStore((state) => state.config);
  const imageModels = useDeepRoastStore((state) => state.imageModels);
  const selectedImageModel = useDeepRoastStore((state) => state.selectedImageModel);
  const setSelectedImageModel = useDeepRoastStore((state) => state.setSelectedImageModel);
  const mode = useDeepRoastStore((state) => state.imageCreationMode);
  const setMode = useDeepRoastStore((state) => state.setImageCreationMode);
  const imageToImageDraft = useDeepRoastStore((state) => state.imageToImageDraft);

  const [pop, setPop] = useState<PopKey | null>(null);
  const [polishing, setPolishing] = useState(false);
  const [notice, setNotice] = useState("");
  const [ratioEditor, setRatioEditor] = useState<"none" | "ratio" | "pixel">("none");
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const { keyboardInset, visibleHeight } = useMobileKeyboardInset();
  const rootRef = useRef<HTMLElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const polishAbort = useRef<AbortController | null>(null);
  const dragStartRef = useRef<{ y: number; time: number } | null>(null);
  const dragMovedRef = useRef(false);
  const suppressClickRef = useRef(false);

  const sizeOptions = getSizeOptions(model);
  const size = normalizeImageSizeSelection(draft.size, model, sizeOptions);
  const modelIds = imageModels.map((item) => item.id);
  const activeModel = modelIds.includes(selectedImageModel) ? selectedImageModel : model;
  const nonGeminiModelIds = modelIds.filter((id) => !isGeminiImageModel(id));
  const editModelIds = nonGeminiModelIds.length > 0 ? nonGeminiModelIds : modelIds;
  const editActiveModel = editModelIds.includes(activeModel) ? activeModel : (editModelIds[0] ?? activeModel);
  const sizeIsPreset = sizeOptions.some((item) => item.value === size);
  const customSupported = isGptImageModel(activeModel);
  const ratioCustomOn = customSupported && (ratioEditor === "ratio" || (ratioEditor === "none" && !sizeIsPreset));
  const pixelCustomOn = customSupported && ratioEditor === "pixel";
  const perImage = config.imageModelCosts?.[activeModel] ?? DEFAULT_IMAGE_MODEL_CREDIT_COST;
  const cost = generationCost(draft.count, perImage);
  const canAfford = isAdmin || credits >= cost;
  const available =
    canUseImageGeneration(isAdmin ? "admin" : "user", config.imageGenerationEnabled !== false) && Boolean(model);
  const prompt = draft.prompt;
  const styleLabel = IMAGE_STYLE_PRESETS.find((preset) => preset.prompt === draft.stylePrompt)?.label ?? "无预设";
  const canSubmit = Boolean(prompt.trim()) && !generating && !polishing && available && prompt.length <= 12000;

  function collapseMobile() {
    setPop(null);
    onMobileExpandedChange(false);
    taRef.current?.blur();
  }

  function expandAndFocusPrompt() {
    onMobileExpandedChange(true);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => taRef.current?.focus(), 20);
    });
  }

  const composerStyle = useMemo(() => {
    const style: React.CSSProperties & Record<string, string> = {};
    if (dragOffsetY !== 0) style["--rd-drag-y"] = `${dragOffsetY}px`;
    if (keyboardInset > 0) {
      style.bottom = `${keyboardInset + 8}px`;
      if (visibleHeight > 180) {
        style.maxHeight = `${Math.max(160, visibleHeight - 20)}px`;
      }
    }
    return style;
  }, [dragOffsetY, keyboardInset, visibleHeight]);

  useEffect(() => {
    if (!pop) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPop(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPop(null);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pop]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(200, ta.scrollHeight)}px`;
  }, [prompt]);

  useEffect(() => () => polishAbort.current?.abort(), []);

  function submit() {
    const value = prompt.trim();
    if (!value || !canSubmit) return;
    if (!canAfford) {
      setNotice(`积分不足，这一批需要 ${cost} 积分`);
      onWalletClick();
      return;
    }
    setNotice("");
    const finalPrompt = draft.stylePrompt ? `${draft.stylePrompt}\n\n${value}` : value;
    collapseMobile();
    onGenerate(finalPrompt, size, draft.count);
  }

  async function polish() {
    const original = prompt.trim();
    if (!original || polishing || generating) return;
    if (!isAdmin && credits < POLISH_PROMPT_CREDIT_COST) {
      setNotice("积分不足，润色需要 1 积分");
      onWalletClick();
      return;
    }
    polishAbort.current?.abort();
    const controller = new AbortController();
    polishAbort.current = controller;
    setPolishing(true);
    setNotice("");
    try {
      const data = await apiJson<{ prompt?: string; model?: string }>("/api/polish-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ prompt: original }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const result = parsePromptPolishResponse(data);
      commitPolishedPrompt({ original, polished: result.prompt });
      if (!isAdmin) setCredits((current) => Math.max(0, current - POLISH_PROMPT_CREDIT_COST));
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setNotice(promptPolishError(error));
      if (error instanceof ApiError && error.status === 402) onWalletClick();
    } finally {
      if (polishAbort.current === controller) {
        polishAbort.current = null;
        setPolishing(false);
      }
    }
  }

  function token(key: PopKey, label: string, value: string) {
    return (
      <button
        type="button"
        className={`rd-tok${key === "mode" ? " is-mode" : ""}${pop === key ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={pop === key}
        title={`${label}：${value}`}
        onClick={() => setPop(pop === key ? null : key)}
      >
        <span className="rd-tok__lbl">{label}</span>
        <b>{value}</b>
        <AppIcon name="chevron-down" size={11} className="rd-tok__chev" />
      </button>
    );
  }

  function option(key: string, label: string, selected: boolean, onPick: () => void, hint?: string) {
    return (
      <button key={key} type="button" role="menuitemradio" aria-checked={selected} className={selected ? "is-on" : ""} onClick={() => { onPick(); setPop(null); }}>
        <span>{label}</span>
        {hint && <small>{hint}</small>}
        <i aria-hidden="true">{selected ? <AppIcon name="check" size={12} strokeWidth={2.4} /> : null}</i>
      </button>
    );
  }

  useEffect(() => {
    if (mode === "edit" && selectedImageModel !== editActiveModel && editModelIds.includes(editActiveModel)) {
      setSelectedImageModel(editActiveModel);
    }
  }, [mode, selectedImageModel, editActiveModel, editModelIds, setSelectedImageModel]);

  const modeLabel = CREATION_MODES.find(([id]) => id === mode)?.[1] ?? "文生图";
  const modeToken = (
    <div className="rd-popwrap">
      {token("mode", "模式", modeLabel)}
      {pop === "mode" && (
        <div className="rd-pop" role="menu">
          <h6>创作模式</h6>
          {CREATION_MODES.map(([id, label, hint]) =>
            option(
              id,
              label,
              id === mode,
              () => {
                if (id === "edit" && selectedImageModel !== editActiveModel && editModelIds.includes(editActiveModel)) {
                  setSelectedImageModel(editActiveModel);
                }
                setMode(id);
              },
              hint,
            ),
          )}
        </div>
      )}
    </div>
  );

  const ratioShortLabel = sizeIsPreset ? sizeAspect(size).label : imageSizeLabel(size).split(" ")[0] || size;
  const compactMetaLabel =
    mode === "text"
      ? `${ratioShortLabel}${draft.count > 1 ? ` · ×${draft.count}` : ""}`
      : modeLabel;
  const compactPromptText =
    mode === "text"
      ? prompt.trim() || "描述你想要的画面……"
      : `${modeLabel} · 点击展开继续操作`;

  const grabHandle = (
    <div className="rd-composer__grab">
      <button
        type="button"
        className="rd-composer__handle"
        aria-expanded={mobileExpanded}
        aria-controls="rd-composer-body"
        aria-label={mobileExpanded ? "收起创作面板" : "展开创作面板"}
        onPointerDown={(event) => {
          dragStartRef.current = { y: event.clientY, time: event.timeStamp };
          dragMovedRef.current = false;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = dragStartRef.current;
          if (!start) return;
          const rawDy = event.clientY - start.y;
          if (Math.abs(rawDy) > 6) dragMovedRef.current = true;
          const damped = mobileExpanded
            ? rawDy >= 0 ? Math.min(84, rawDy * 0.65) : Math.max(-18, rawDy * 0.22)
            : rawDy <= 0 ? Math.max(-36, rawDy * 0.55) : Math.min(14, rawDy * 0.2);
          setDragOffsetY(Math.round(damped));
        }}
        onPointerUp={(event) => {
          const start = dragStartRef.current;
          dragStartRef.current = null;
          setDragging(false);
          setDragOffsetY(0);
          if (!start) return;
          const dy = event.clientY - start.y;
          const dt = Math.max(1, event.timeStamp - start.time);
          const velocity = Math.abs(dy) / dt;
          let next = resolveMobileComposerDrag(start.y, event.clientY, mobileExpanded);
          if (next === mobileExpanded && Math.abs(dy) >= 18 && velocity > 0.45) {
            next = dy < 0;
          }
          if (dragMovedRef.current) {
            suppressClickRef.current = true;
            if (next !== mobileExpanded) {
              if (!next) collapseMobile();
              else onMobileExpandedChange(true);
            }
          }
        }}
        onPointerCancel={() => {
          dragStartRef.current = null;
          dragMovedRef.current = false;
          setDragging(false);
          setDragOffsetY(0);
        }}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (mobileExpanded) collapseMobile();
          else onMobileExpandedChange(true);
        }}
      >
        <span className="rd-composer__rail" aria-hidden="true" />
        {mobileExpanded ? (
          <span className="rd-composer__fold-tag" aria-hidden="true">
            收起
            <AppIcon name="chevron-down" size={11} />
          </span>
        ) : null}
      </button>
    </div>
  );

  const compactBar = (
    <div className="rd-composer__compact">
      <button
        type="button"
        className={`rd-compact-params${mode !== "text" ? " is-mode-active" : ""}`}
        onClick={() => onMobileExpandedChange(true)}
        aria-label="展开创作参数"
        title="展开调整模式、模型与画幅"
      >
        <AppIcon name="sliders" size={13} />
        <span>{compactMetaLabel}</span>
      </button>
      <button
        type="button"
        className={`rd-compact-prompt${mode === "text" && prompt.trim() ? " has-text" : ""}`}
        onClick={() => (mode === "text" ? expandAndFocusPrompt() : onMobileExpandedChange(true))}
        aria-label={mode === "text" ? "展开并输入画面描述" : `展开${modeLabel}面板`}
      >
        <span>{compactPromptText}</span>
      </button>
      {generating ? (
        <button type="button" className="rd-go rd-go--compact" onClick={onStop}>停止</button>
      ) : mode === "text" && prompt.trim() ? (
        <button type="button" className="rd-go rd-go--compact" disabled={!canSubmit} onClick={submit}>
          <span>生成</span>
          <span className="rd-go__cost">{isAdmin ? "免费" : cost}</span>
        </button>
      ) : (
        <button
          type="button"
          className="rd-compact-expand"
          onClick={() => onMobileExpandedChange(true)}
          aria-label="展开创作面板"
          title="展开"
        >
          <AppIcon name="chevron-down" size={14} className="rd-compact-expand__icon" />
        </button>
      )}
    </div>
  );

  const shellClasses = `rd-composer${mode !== "text" ? " is-sheet" : ""}${mobileExpanded ? " is-expanded" : " is-collapsed"}${dragging ? " is-dragging" : ""}`;

  if (mode !== "text") {
    return (
      <section ref={rootRef} className={shellClasses} style={composerStyle} aria-label={mode === "edit" ? "图生图" : "反推提示词"}>
        {grabHandle}
        {compactBar}
        <div id="rd-composer-body" className="rd-composer__expandable">
          <div className="rd-composer__expandable-inner rd-sheet__inner">
            <div className="rd-sheet__head">
              {modeToken}
              <span className="rd-sheet__hint">{CREATION_MODES.find(([id]) => id === mode)?.[2]}</span>
              <span className="rd-grow" />
              <button type="button" className="rd-x" onClick={() => setMode("text")} aria-label="回到文生图" title="回到文生图">
                <AppIcon name="close" size={15} />
              </button>
            </div>
            <div className="rd-sheet__body">
              {mode === "edit" ? (
                <Img2ImgPanel
                  desktop
                  size={size}
                  imageModel={editActiveModel}
                  imageModels={editModelIds}
                  onImageModelChange={setSelectedImageModel}
                  imageModelCosts={config.imageModelCosts}
                  isAdmin={isAdmin}
                  draft={imageToImageDraft}
                  sizeOptions={getSizeOptions(editActiveModel)}
                  generating={generating}
                  disabled={!available}
                  onGenerate={(genPrompt, genSize) => {
                    collapseMobile();
                    onGenerate(genPrompt, genSize);
                  }}
                  onEditImage={(request, editSize) => {
                    collapseMobile();
                    onEditImage(request, editSize);
                  }}
                  onEditImageBatch={(request, editSize, count) => {
                    collapseMobile();
                    if (count > 1) onEditImageBatch(request, editSize, count);
                    else onEditImage(request, editSize);
                  }}
                  onStopGenerate={onStop}
                />
              ) : (
                <ReversePromptPanel
                  disabled={generating}
                  onPrompt={(value) => {
                    setDraft({ prompt: value });
                    setMode("text");
                    expandAndFocusPrompt();
                  }}
                  onCloseToolbar={() => setMode("text")}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={rootRef}
      className={shellClasses}
      style={composerStyle}
      aria-label="创作输入框"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pop && mobileExpanded) {
          collapseMobile();
        }
      }}
    >
      {grabHandle}
      {compactBar}
      <div id="rd-composer-body" className="rd-composer__expandable">
        <div className="rd-composer__expandable-inner">
          <textarea
            id="rd-prompt"
            ref={taRef}
            rows={1}
            value={prompt}
            maxLength={12000}
            placeholder="描述你想要的画面……"
            onFocus={() => onMobileExpandedChange(true)}
            onChange={(event) => setDraft({ prompt: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            aria-label="提示词"
          />
          {(notice || !available || prompt.length >= 500) && (
            <div className="rd-meta-row">
              {(notice || !available) && (
                <p className="rd-warn">
                  {notice || (!activeModel ? (isAdmin ? "尚未配置生图模型，请到模型配置添加" : "尚未配置生图模型，暂时无法生成") : isAdmin ? "未配置生图服务，请打开模型配置设置" : "生图服务暂未开放")}
                </p>
              )}
              {prompt.length >= 500 && (
                <span className={`rd-count${prompt.length > 12000 ? " is-over" : ""}`}>
                  {prompt.length.toLocaleString()} / 12,000
                </span>
              )}
            </div>
          )}
          <div className="rd-tools">
            {modeToken}
            <span className="rd-sep" aria-hidden="true" />
            <div className="rd-popwrap is-model">
              {token("model", "模型", activeModel || "未配置")}
              {pop === "model" && (
                <div className="rd-pop" role="menu">
                  <h6>生图模型</h6>
                  {imageModels.map((item) => option(item.id, item.id, item.id === activeModel, () => setSelectedImageModel(item.id), `${config.imageModelCosts?.[item.id] ?? DEFAULT_IMAGE_MODEL_CREDIT_COST} 积分/张`))}
                </div>
              )}
            </div>
            <div className="rd-popwrap">
              {token("ratio", "画幅", sizeIsPreset ? sizeAspect(size).label : imageSizeLabel(size))}
              {pop === "ratio" && (
                <div className="rd-pop is-ratio" role="menu">
                  <h6>画幅</h6>
                  {sizeOptions.map((item) => option(item.value, item.label, item.value === size && !ratioCustomOn && !pixelCustomOn, () => { setRatioEditor("none"); setDraft({ size: item.value }); }))}
                  {customSupported && (
                    <>
                      <div className="rd-pop__sep" aria-hidden="true" />
                      <button type="button" role="menuitemradio" aria-checked={ratioCustomOn} className={ratioCustomOn ? "is-on" : ""} onClick={() => setRatioEditor("ratio")}>
                        <span>自定义比例</span><small>按宽高比</small><i aria-hidden="true">{ratioCustomOn ? <AppIcon name="check" size={12} strokeWidth={2.4} /> : null}</i>
                      </button>
                      <button type="button" role="menuitemradio" aria-checked={pixelCustomOn} className={pixelCustomOn ? "is-on" : ""} onClick={() => setRatioEditor("pixel")}>
                        <span>像素设置</span><small>256–2048</small><i aria-hidden="true">{pixelCustomOn ? <AppIcon name="check" size={12} strokeWidth={2.4} /> : null}</i>
                      </button>
                      {ratioCustomOn && (
                        <div className="rd-pop__editor">
                          <CustomRatioEditor key={`${activeModel}:${size}`} size={size} disabled={generating} onChange={(next) => { setDraft({ size: next }); setPop(null); }} />
                        </div>
                      )}
                      {pixelCustomOn && (
                        <div className="rd-pop__editor">
                          <CustomPixelEditor key={`pixel:${activeModel}:${size}`} size={size} disabled={generating} onChange={(next) => { setDraft({ size: next }); setPop(null); }} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="rd-popwrap">
              {token("count", "张数", `× ${draft.count}`)}
              {pop === "count" && (
                <div className="rd-pop is-narrow" role="menu">
                  <h6>一次生成</h6>
                  {[1, 2, 3, 4, 5].map((n) => option(String(n), `${n} 张`, n === draft.count, () => setDraft({ count: n })))}
                </div>
              )}
            </div>
            <div className="rd-popwrap">
              {token("style", "风格", styleLabel)}
              {pop === "style" && (
                <div className="rd-pop" role="menu">
                  <h6>风格预设</h6>
                  {IMAGE_STYLE_PRESETS.map((preset) =>
                    option(
                      preset.label,
                      preset.label,
                      draft.stylePrompt === preset.prompt,
                      () => setDraft({ stylePrompt: preset.prompt }),
                      preset.prompt ? undefined : "按原始提示词",
                    ),
                  )}
                </div>
              )}
            </div>
            <div className="rd-actions">
              <button type="button" className="rd-polish" disabled={!prompt.trim() || polishing || generating} onClick={() => void polish()}>
                <AppIcon name="sparkles" size={13} />
                {polishing ? "润色中…" : "润色"}
                <span>{isAdmin ? "免费" : POLISH_PROMPT_CREDIT_COST}</span>
              </button>
              {generating ? (
                <button type="button" className="rd-go" onClick={onStop}>停止</button>
              ) : (
                <button type="button" className="rd-go" disabled={!canSubmit} onClick={submit}>
                  <span>生成</span>
                  <span className="rd-go__cost">{isAdmin ? "免费" : cost}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
