"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_IMAGE_MODEL_CREDIT_COST } from "@/types";
import Dialog from "@/components/ui/Dialog";
import { AppIcon } from "@/components/ui/icons";
import { canUseImageGeneration } from "@/lib/image-generation-access";
import { generationCost } from "@/lib/image-workspace";
import { useDeepRoastStore } from "@/lib/store";
import ReversePromptPanel from "./ReversePromptPanel";
import Img2ImgPanel from "./Img2ImgPanel";
import { getImageModelLabel } from "./image-model-presentation";
import { resolveMobileComposerDrag } from "./mobile-composer-state";
import type { ImageEditRequest } from "@/lib/image-edit-contract";

interface ImageMobileBarProps {
  prompt: string;
  setPrompt: (v: string) => void;
  count: number;
  setCount: (count: number) => void;
  stylePrompt: string;
  size: string;
  setSize: (v: string) => void;
  sizeOptions: { value: string; label: string }[];
  imageModels: string[];
  selectedImageModel: string;
  onModelChange: (model: string) => void;
  generating: boolean;
  credits: number;
  isAdmin?: boolean;
  imageGenerationEnabled?: boolean;
  onGenerate: (prompt: string, size: string, count?: number) => void;
  /** 图生图：按结构化任务编辑 */
  onEditImage?: (request: ImageEditRequest, size: string) => void;
  /** 图生图批量：按结构化任务生成多个变体 */
  onEditImageBatch?: (
    request: ImageEditRequest,
    size: string,
    count: number,
  ) => void;
  onStopGenerate: () => void;
  /** 输入条实际高度（结果区预留底部空间） */
  onHeightChange?: (height: number) => void;
  keyboardInset: number;
  keyboardOpen: boolean;
  /** 外部请求直接打开图生图面板（用于对已有生成图继续修改） */
  openImageToImage: boolean;
  onImageToImageOpened?: () => void;
}

/** Mobile presentation of the same session-scoped draft used on desktop. */
export default function ImageMobileBar({
  prompt,
  setPrompt,
  size,
  setSize,
  count,
  setCount,
  stylePrompt,
  sizeOptions,
  imageModels,
  selectedImageModel,
  onModelChange,
  generating,
  credits,
  isAdmin = false,
  imageGenerationEnabled = true,
  onGenerate,
  onEditImage,
  onEditImageBatch,
  onStopGenerate,
  onHeightChange,
  keyboardInset,
  keyboardOpen,
  openImageToImage,
  onImageToImageOpened,
}: ImageMobileBarProps) {
  const imageToImageDraft = useDeepRoastStore(
    (state) => state.imageToImageDraft,
  );
  const imageModelCosts = useDeepRoastStore(
    (state) => state.config.imageModelCosts,
  );
  const userSessionVersion = useDeepRoastStore(
    (state) => state.userSessionVersion,
  );
  const imageCostPerImage =
    imageModelCosts?.[selectedImageModel] ?? DEFAULT_IMAGE_MODEL_CREDIT_COST;
  const cost = generationCost(count, imageCostPerImage);
  const canAfford = isAdmin || credits >= cost;
  const imageGenerationAvailable = canUseImageGeneration(
    isAdmin ? "admin" : "user",
    imageGenerationEnabled,
  );
  const [toolbarOpen, setToolbarOpen] = useState<
    "reverse" | "img2img" | "model" | "size" | null
  >(null);
  const [expanded, setExpanded] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragChangedStateRef = useRef(false);

  useEffect(() => {
    setToolbarOpen(null);
    setExpanded(false);
  }, [userSessionVersion]);
  useEffect(() => {
    if (!generating) return;
    setToolbarOpen(null);
    setExpanded(false);
    taRef.current?.blur();
  }, [generating]);
  useEffect(() => {
    if (!openImageToImage) return;
    if (window.matchMedia("(max-width: 767px)").matches)
      setToolbarOpen("img2img");
    onImageToImageOpened?.();
  }, [onImageToImageOpened, openImageToImage]);
  useEffect(() => {
    if (!toolbarOpen) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setToolbarOpen(null);
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [toolbarOpen]);
  useEffect(() => {
    const element = barRef.current;
    if (!element || !onHeightChange) return;
    const report = () => onHeightChange(element.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange, keyboardInset]);
  useEffect(() => {
    const textarea = taRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 68), 120)}px`;
  }, [prompt]);

  const selectedModelLabel = getImageModelLabel(
    selectedImageModel || imageModels[0],
  );
  const selectedSizeLabel =
    sizeOptions.find((option) => option.value === size)?.label || size;
  const compactSizeLabel = selectedSizeLabel.split(/[（(]/)[0].trim();
  const sheetLabel =
    toolbarOpen === "model"
      ? "选择生图模型"
      : toolbarOpen === "size"
        ? "生成设置"
        : toolbarOpen === "reverse"
          ? "反推设置"
          : "图生图设置";

  function handleGenerate() {
    const text = prompt.trim();
    if (!text || generating || !imageGenerationAvailable || !canAfford) return;
    const finalPrompt = stylePrompt ? `${stylePrompt}\n\n${text}` : text;
    onGenerate(finalPrompt, size, count);
    // Keep the draft editable after an error and consistent across screen sizes.
  }

  function finishDrag(clientY: number) {
    if (dragStartYRef.current === null) return;
    const nextExpanded = resolveMobileComposerDrag(
      dragStartYRef.current,
      clientY,
      expanded,
    );
    dragChangedStateRef.current = nextExpanded !== expanded;
    dragStartYRef.current = null;
    setExpanded(nextExpanded);
  }

  return (
    <div
      ref={barRef}
      className={`mobile-composer-shell md:hidden fixed z-40 ${expanded ? "is-expanded" : "is-collapsed"}`}
      style={{
        bottom: keyboardOpen ? "0px" : "var(--mobile-bottom-nav-height, 0px)",
      }}
    >
      <Dialog
        open={Boolean(toolbarOpen)}
        onClose={() => setToolbarOpen(null)}
        label={sheetLabel}
      >
        <div
          className="mobile-creation-overlay"
          onClick={() => setToolbarOpen(null)}
          aria-hidden="true"
        />
        <section
          id="mobile-creation-sheet"
          className={`mobile-creation-sheet mobile-creation-sheet--${toolbarOpen}`}
        >
          <div className="mobile-creation-sheet__header">
            <span
              className="mobile-creation-sheet__handle"
              aria-hidden="true"
            />
            <div>
              <h2 className="ui-kicker">{sheetLabel}</h2>
              <p className="mobile-creation-sheet__subtitle">
                {toolbarOpen === "model"
                  ? "先选清楚，再开始生成"
                  : toolbarOpen === "img2img"
                    ? "选择素材，描述你想修改的地方"
                    : "调整后继续使用当前草稿"}
              </p>
            </div>
            <button
              type="button"
              className="mobile-creation-sheet__close"
              onClick={() => setToolbarOpen(null)}
              aria-label="关闭工具面板"
            >
              ×
            </button>
          </div>
          <div className="mobile-creation-sheet__body">
            {toolbarOpen === "reverse" ? (
              <ReversePromptPanel
                disabled={generating}
                onPrompt={setPrompt}
                onCloseToolbar={() => setToolbarOpen(null)}
              />
            ) : toolbarOpen === "img2img" ? (
              <Img2ImgPanel
                size={size}
                imageModel={selectedImageModel}
                imageModelCosts={imageModelCosts}
                isAdmin={isAdmin}
                draft={imageToImageDraft}
                sizeOptions={sizeOptions}
                generating={generating}
                disabled={!imageGenerationAvailable}
                onGenerate={onGenerate}
                onEditImage={onEditImage}
                onEditImageBatch={onEditImageBatch}
                onStopGenerate={onStopGenerate}
              />
            ) : toolbarOpen === "model" ? (
              <div
                className="mobile-model-picker"
                role="group"
                aria-label="生图模型"
              >
                {imageModels.map((modelId) => (
                  <button
                    key={modelId}
                    type="button"
                    aria-pressed={modelId === selectedImageModel}
                    className={
                      modelId === selectedImageModel ? "is-active" : undefined
                    }
                    disabled={generating}
                    onClick={() => {
                      onModelChange(modelId);
                      setToolbarOpen(null);
                    }}
                  >
                    <span className="mobile-model-picker__name">
                      <strong>{getImageModelLabel(modelId)}</strong>
                      <small>{modelId}</small>
                    </span>
                    <span className="mobile-model-picker__cost">
                      {isAdmin
                        ? "免费"
                        : `${imageModelCosts?.[modelId] ?? DEFAULT_IMAGE_MODEL_CREDIT_COST} 积分/张`}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mobile-generation-settings">
                <p className="creation-section-label">画幅比例</p>
                <div
                  className="mobile-size-picker"
                  role="group"
                  aria-label="图片比例"
                >
                  {sizeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={option.value === size}
                      className={
                        option.value === size ? "is-active" : undefined
                      }
                      disabled={generating}
                      onClick={() => setSize(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <fieldset>
                  <legend className="creation-section-label">生成数量</legend>
                  <div className="mobile-count-picker">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={value === count}
                        disabled={generating}
                        className={value === count ? "is-active" : undefined}
                        onClick={() => setCount(value)}
                      >
                        {value} 张
                      </button>
                    ))}
                  </div>
                </fieldset>
                <p className="mobile-settings-total">
                  本次 {count} 张 ·{" "}
                  {isAdmin ? "管理员免费" : `预计 ${cost} 积分`}
                </p>
                <button
                  type="button"
                  className="ui-button ui-button--primary w-full"
                  onClick={() => setToolbarOpen(null)}
                >
                  使用这些设置
                </button>
              </div>
            )}
          </div>
        </section>
      </Dialog>

      <button
        type="button"
        className="mobile-composer-handle"
        aria-expanded={expanded}
        aria-controls="mobile-composer-expanded"
        aria-label={expanded ? "收起生成设置" : "展开生成设置"}
        onPointerDown={(event) => {
          dragStartYRef.current = event.clientY;
          dragChangedStateRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => finishDrag(event.clientY)}
        onPointerCancel={() => {
          dragStartYRef.current = null;
          dragChangedStateRef.current = false;
        }}
        onClick={() => {
          if (dragChangedStateRef.current) {
            dragChangedStateRef.current = false;
            return;
          }
          setExpanded((current) => !current);
        }}
      >
        <span className="mobile-composer-handle__rail" aria-hidden="true" />
        <span>{expanded ? "下拉收起" : "上滑展开"}</span>
      </button>

      {!expanded ? (
        <div className="mobile-composer-compact">
          <button
            type="button"
            className="mobile-composer-compact__details"
            onClick={() => setExpanded(true)}
            aria-label="展开并编辑画面描述"
          >
            <span className="mobile-composer-compact__prompt">
              {prompt.trim() || "写下画面描述…"}
            </span>
            <span className="mobile-composer-compact__meta">
              {selectedModelLabel} · {count} 张 · {compactSizeLabel}
            </span>
          </button>
          <div className="mobile-generation-summary" aria-label="本次生成费用">
            <span>{isAdmin ? "管理员免费" : `预计 ${cost} 积分`}</span>
            <span>余额 {credits}</span>
          </div>
        </div>
      ) : null}

      <div
        id="mobile-composer-expanded"
        className="mobile-composer-expanded"
        hidden={!expanded}
      >
        <div className="mobile-composer-heading">
          <label htmlFor="mobile-image-prompt">画面描述</label>
          <span>同一份草稿 · 跨屏同步</span>
        </div>
        <div className="mobile-composer-input-row">
          <div className="mobile-composer-input">
            <textarea
              id="mobile-image-prompt"
              ref={taRef}
              value={prompt}
              maxLength={2000}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="描述主体、场景和你想要的光线…"
              rows={2}
              disabled={generating || !imageGenerationAvailable}
            />
          </div>
        </div>
        <div className="mobile-composer-selection">
          <button
            type="button"
            className="mobile-composer-chip mobile-composer-model"
            disabled={generating || imageModels.length < 2}
            onClick={() => setToolbarOpen("model")}
            aria-expanded={toolbarOpen === "model"}
            aria-controls="mobile-creation-sheet"
            title={selectedImageModel}
          >
            <span>{selectedModelLabel}</span>
            <span aria-hidden="true">⌄</span>
          </button>
          <button
            type="button"
            className="mobile-composer-size"
            disabled={generating}
            onClick={() => setToolbarOpen("size")}
            aria-expanded={toolbarOpen === "size"}
            aria-controls="mobile-creation-sheet"
          >
            <span>
              {count} 张 · {compactSizeLabel}
            </span>
            <AppIcon name="settings" size={14} />
          </button>
        </div>
        <div className="mobile-composer-tools">
          <button
            type="button"
            className="mobile-composer-chip"
            onClick={() => setToolbarOpen("img2img")}
            aria-expanded={toolbarOpen === "img2img"}
            aria-controls="mobile-creation-sheet"
          >
            图生图
          </button>
          <button
            type="button"
            className="mobile-composer-chip"
            onClick={() => setToolbarOpen("reverse")}
            aria-expanded={toolbarOpen === "reverse"}
            aria-controls="mobile-creation-sheet"
          >
            反推提示词
          </button>
          {stylePrompt ? (
            <span className="mobile-style-applied">已应用桌面风格</span>
          ) : null}
        </div>
        {!imageGenerationAvailable ? (
          <p className="mobile-composer-alert">
            生图功能暂时关闭，反推提示词仍可使用
          </p>
        ) : null}
        <div className="mobile-generation-summary" aria-label="本次生成费用">
          <span>
            {isAdmin ? (
              "管理员免费"
            ) : (
              <>
                本次预计 <strong>{cost}</strong> 积分
              </>
            )}
          </span>
          <span>余额 {credits} 积分</span>
        </div>
      </div>
      <div className="mobile-composer-action">
        <button
          type="button"
          className={
            generating
              ? "mobile-composer-submit is-stopping"
              : "mobile-composer-submit"
          }
          onClick={generating ? onStopGenerate : handleGenerate}
          disabled={
            !generating &&
            (!prompt.trim() || !canAfford || !imageGenerationAvailable)
          }
        >
          {generating
            ? "停止生成"
            : `生成 ${count} 张 · ${isAdmin ? "免费" : `${cost} 积分`}`}
          {!generating ? <span aria-hidden="true">→</span> : null}
        </button>
        {!canAfford ? (
          <p className="mobile-composer-alert">
            积分不足，可在“我的”中打开钱包
          </p>
        ) : null}
      </div>
    </div>
  );
}
