"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";
import type { ImageRecord } from "@/types";
import { DEFAULT_IMAGE_MODEL_CREDIT_COST, IMAGE_STYLE_PRESETS } from "@/types";
import { useDeepRoastStore } from "@/lib/store";
import { useConfirm } from "@/components/ConfirmProvider";
import { imageSizeLabel, normalizeImageSizeSelection } from "@/lib/custom-image-ratio";
import { isGptImageModel } from "@/lib/image-model-capabilities";
import { copyText } from "@/lib/browser-actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import { CustomPixelEditor, CustomRatioEditor } from "@/components/ImageGen/ImageRatioPicker";
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

const SUGGESTIONS = [
  "雨夜的老城区咖啡馆，玻璃上的水汽，暖黄灯光从里面透出来，35mm 胶片",
  "一只橘猫趴在旧书店窗台上晒太阳，柔和逆光",
  "极简产品摄影：磨砂玻璃香水瓶，奶油色背景，硬光阴影",
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

export interface RedesignStudioProps {
  view: RedesignView;
  model: string;
  history: ImageRecord[];
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
  const setSelectedImageModel = useDeepRoastStore((state) => state.setSelectedImageModel);
  const setTextToImageDraft = useDeepRoastStore((state) => state.setTextToImageDraft);
  const setImageToImageDraft = useDeepRoastStore((state) => state.setImageToImageDraft);
  const setImageCreationMode = useDeepRoastStore((state) => state.setImageCreationMode);

  const [preview, setPreview] = useState<ImageRecord | null>(null);
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
    const ok = await confirm({
      title: group ? "删除整个版本组" : "删除选中作品",
      message: group
        ? `将删除该版本组的全部图片（共 ${selectedGroupSize} 张，含未显示的其他版本），此操作不可撤销。`
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
    window.setTimeout(() => document.getElementById("rd-prompt")?.focus(), 30);
  }

  function continueEditing(image: ImageRecord) {
    if (!image.imageUrl) return;
    setImageToImageDraft(createImageContinuationDraft(image));
    setImageCreationMode("edit");
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
    onGenerate(batch.prompt, batch.size, Math.min(5, Math.max(1, batch.images.length)));
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
        {picking && <span className="rd-pick" aria-hidden="true">{picked ? "✓" : ""}</span>}
        {!picking && <div className="rd-quick" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => continueEditing(image)} title="继续修改" aria-label="继续修改">✎</button>
          <button
            type="button"
            title="下载原图"
            aria-label="下载原图"
            disabled={cardDownload.status === "pending"}
            aria-busy={cardDownload.status === "pending"}
            onClick={() => void cardDownload.run((signal) => downloadImage(image, signal), "已发起下载", "下载未完成，请检查网络后重试。")}
          >
            ↓
          </button>
          <button
            type="button"
            className={armed === image.id ? "is-armed" : ""}
            onClick={() => armDelete(image.id)}
            title={armed === image.id ? "再点一次确认删除" : "删除"}
          >
            {armed === image.id ? "删除" : "✕"}
          </button>
        </div>}
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
    return (
      <section className="rd-error" role="alert">
        <div>
          <b>{imageTask.error.kind === "credits" ? "积分不足" : imageTask.error.kind === "network" ? "网络连接中断" : "服务暂时没有完成生成"}</b>
          <p>
            {imageTask.error.kind === "credits"
              ? "查看余额后调整生成数量，描述和参数已保留。"
              : imageTask.error.kind === "network"
                ? "请先检查网络，描述和参数已保留，可返回修改或手动重试。"
                : "可以稍后重试或返回调整参数，不会自动再次提交。"}
          </p>
          {imageTask.error.kind === "service" && imageTask.error.message && <p className="rd-err-msg">{imageTask.error.message}</p>}
        </div>
        {imageTask.error.kind === "credits" ? (
          <button type="button" className="rd-bb is-visible" onClick={onWalletClick}>去钱包</button>
        ) : (
          <button type="button" className="rd-bb is-visible" onClick={onRetryGenerate}>重试</button>
        )}
        <button type="button" className="rd-bb is-visible" onClick={() => { clearImageTask(); focusPrompt(); }}>返回修改</button>
        <button type="button" className="rd-x" onClick={clearImageTask} aria-label="关闭">✕</button>
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
            <p>写一句描述就能开始，作品会按批次留在这里。</p>
            <div className="rd-sugg">
              {SUGGESTIONS.map((text) => (
                <button key={text} type="button" onClick={() => { setTextToImageDraft({ prompt: text }); focusPrompt(); }}>{text}</button>
              ))}
            </div>
          </div>
        ) : (
          days.map((day) => (
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
          ))
        )}
      </>
    );
  }

  function renderGallery() {
    const list = galleryList;
    return (
      <>
        <div className="rd-gbar">
          <div><h2>图库</h2><span>{history.length} 张作品</span></div>
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
              title={selectedGroupId ? `共 ${selectedGroupSize} 张，含其他版本` : "勾选同一版本组的图片后可用"}
              onClick={() => void batchDelete("version-group")}
            >
              删除版本组
            </button>
            <button type="button" className="rd-bb is-visible" onClick={exitSelecting}>完成</button>
          </div>
        )}
        {list.length ? <div className="rd-grid">{list.map((image) => renderCard(image, false))}</div> : <div className="rd-empty is-small"><p>没有符合条件的作品</p></div>}
      </>
    );
  }

  return (
    <div className={`rd-studio is-${view}`}>
      <div className="rd-stream">
        <div className="rd-wrap">{view === "gallery" ? renderGallery() : renderCreate()}</div>
      </div>
      {view === "create" && (
        <RedesignComposer
          model={model}
          credits={credits}
          isAdmin={isAdmin}
          generating={generating}
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
                <button type="button" className="rd-bb is-visible" onClick={() => continueEditing(preview)}>✎ 继续修改</button>
                <button
                  type="button"
                  className="rd-bb is-visible"
                  disabled={previewDownload.status === "pending"}
                  aria-busy={previewDownload.status === "pending"}
                  onClick={() => void previewDownload.run((signal) => downloadImage(preview, signal), "已发起下载", "下载未完成，请检查网络后重试。")}
                >
                  {previewDownload.status === "pending" ? "准备下载…" : previewDownload.status === "success" ? "已发起下载" : "下载原图"}
                </button>
                <button
                  type="button"
                  className="rd-bb is-visible"
                  disabled={previewCopy.status === "pending"}
                  onClick={() => void previewCopy.run(() => copyText(preview.prompt), "提示词已复制")}
                >
                  {previewCopy.status === "pending" ? "正在复制…" : previewCopy.status === "success" ? "已复制" : "复制提示词"}
                </button>
                <button type="button" className="rd-bb is-visible is-danger" onClick={() => void deleteFromPreview(preview)}>删除</button>
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
  onGenerate: (prompt: string, size: string, count?: number) => void;
  onWalletClick: () => void;
  onStop: () => void;
  onEditImage: (request: ImageEditRequest, size: string) => void;
  onEditImageBatch: (request: ImageEditRequest, size: string, count: number) => void;
}

function RedesignComposer({ model, credits, isAdmin, generating, onGenerate, onWalletClick, onStop, onEditImage, onEditImageBatch }: ComposerProps) {
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
  const rootRef = useRef<HTMLElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const polishAbort = useRef<AbortController | null>(null);

  const sizeOptions = getSizeOptions(model);
  const size = normalizeImageSizeSelection(draft.size, model, sizeOptions);
  const modelIds = imageModels.map((item) => item.id);
  const activeModel = modelIds.includes(selectedImageModel) ? selectedImageModel : model;
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
      <button type="button" className={`rd-tok${key === "mode" ? " is-mode" : ""}${pop === key ? " is-open" : ""}`} aria-haspopup="menu" aria-expanded={pop === key} onClick={() => setPop(pop === key ? null : key)}>
        <span className="rd-tok__lbl">{label}</span><b>{value}</b>
      </button>
    );
  }

  function option(key: string, label: string, selected: boolean, onPick: () => void, hint?: string) {
    return (
      <button key={key} type="button" role="menuitemradio" aria-checked={selected} className={selected ? "is-on" : ""} onClick={() => { onPick(); setPop(null); }}>
        <span>{label}</span>{hint && <small>{hint}</small>}<i aria-hidden="true">{selected ? "✓" : ""}</i>
      </button>
    );
  }

  const modeLabel = CREATION_MODES.find(([id]) => id === mode)?.[1] ?? "文生图";
  const modeToken = (
    <div className="rd-popwrap">
      {token("mode", "模式", modeLabel)}
      {pop === "mode" && (
        <div className="rd-pop" role="menu">
          <h6>创作模式</h6>
          {CREATION_MODES.map(([id, label, hint]) => option(id, label, id === mode, () => setMode(id), hint))}
        </div>
      )}
    </div>
  );

  if (mode !== "text") {
    return (
      <section ref={rootRef} className="rd-composer is-sheet" aria-label={mode === "edit" ? "图生图" : "反推提示词"}>
        <div className="rd-sheet__head">
          {modeToken}
          <span className="rd-sheet__hint">{CREATION_MODES.find(([id]) => id === mode)?.[2]}</span>
          <span className="rd-grow" />
          <button type="button" className="rd-x" onClick={() => setMode("text")} aria-label="回到文生图" title="回到文生图">✕</button>
        </div>
        <div className="rd-sheet__body">
          {mode === "edit" ? (
            <Img2ImgPanel
              desktop
              size={size}
              imageModel={activeModel}
              imageModels={modelIds}
              onImageModelChange={setSelectedImageModel}
              imageModelCosts={config.imageModelCosts}
              isAdmin={isAdmin}
              draft={imageToImageDraft}
              sizeOptions={sizeOptions}
              generating={generating}
              disabled={!available}
              onGenerate={onGenerate}
              onEditImage={onEditImage}
              onEditImageBatch={(request, editSize, count) => {
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
                window.setTimeout(() => taRef.current?.focus(), 30);
              }}
              onCloseToolbar={() => setMode("text")}
            />
          )}
        </div>
      </section>
    );
  }

  return (
    <section ref={rootRef} className="rd-composer" aria-label="创作输入框">
      <textarea
        id="rd-prompt"
        ref={taRef}
        rows={1}
        value={prompt}
        maxLength={12000}
        placeholder="描述你想要的画面……"
        onChange={(event) => setDraft({ prompt: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
        aria-label="提示词"
      />
      {(notice || !available) && <p className="rd-warn">{notice || (!activeModel ? (isAdmin ? "尚未配置生图模型，请到管理控制台添加" : "尚未配置生图模型，暂时无法生成") : isAdmin ? "未配置生图服务，请到管理控制台设置" : "生图服务暂未开放")}</p>}
      <div className="rd-tools">
        {modeToken}
        <span className="rd-sep" aria-hidden="true" />
        <div className="rd-popwrap">
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
                    <span>自定义比例</span><small>按宽高比</small><i aria-hidden="true">{ratioCustomOn ? "✓" : ""}</i>
                  </button>
                  <button type="button" role="menuitemradio" aria-checked={pixelCustomOn} className={pixelCustomOn ? "is-on" : ""} onClick={() => setRatioEditor("pixel")}>
                    <span>像素设置</span><small>256–2048</small><i aria-hidden="true">{pixelCustomOn ? "✓" : ""}</i>
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
              <h6>常用风格</h6>
              {IMAGE_STYLE_PRESETS.map((preset) => option(preset.label, preset.label, preset.prompt === draft.stylePrompt, () => setDraft({ stylePrompt: preset.prompt })))}
            </div>
          )}
        </div>
        <span className="rd-grow" />
        <span className="rd-count">{prompt.length.toLocaleString()} / 12,000</span>
        <button type="button" className="rd-polish" onClick={() => void polish()} disabled={!prompt.trim() || polishing || generating}>
          {polishing ? "润色中…" : "✦ 润色"}<span>{isAdmin ? "免费" : POLISH_PROMPT_CREDIT_COST}</span>
        </button>
        <button type="button" className="rd-go" onClick={submit} disabled={!canSubmit}>
          <span>{generating ? "生成中" : "生成"}</span>
          <span className="rd-go__cost"><i aria-hidden="true" />{isAdmin ? "免费" : cost}</span>
        </button>
      </div>
    </section>
  );
}
