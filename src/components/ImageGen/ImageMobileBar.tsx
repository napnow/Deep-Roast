"use client";

import { useEffect, useRef, useState } from "react";
import { CREDIT_PER_IMAGE } from "@/types";
import { lockPageScroll, unlockPageScroll } from "@/lib/scroll-lock";
import { canUseImageGeneration } from "@/lib/image-generation-access";
import { useDeepRoastStore } from "@/lib/store";
import ReversePromptPanel from "./ReversePromptPanel";
import Img2ImgPanel from "./Img2ImgPanel";
import type { ImageEditRequest } from "@/lib/image-edit-contract";

interface ImageMobileBarProps {
  prompt: string;
  setPrompt: (v: string) => void;
  size: string;
  setSize: (v: string) => void;
  sizeOptions: { value: string; label: string }[];
  generating: boolean;
  credits: number;
  isAdmin?: boolean;
  imageGenerationEnabled?: boolean;
  onGenerate: (prompt: string, size: string) => void;
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

/**
 * 手机端底部输入条（ChatGPT 风格，fixed 定位）：
 * - fixed 固定在视口底部，iOS 键盘弹出时由 visual viewport 自动顶在键盘上方，
 *   页面不会整体滚动偏移
 * - 高度变化通过 ResizeObserver 上报，内容区同步预留空间
 */
export default function ImageMobileBar({
  prompt,
  setPrompt,
  size,
  setSize,
  sizeOptions,
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
  const imageToImageDraft = useDeepRoastStore((state) => state.imageToImageDraft);
  const canAfford = isAdmin || credits >= CREDIT_PER_IMAGE;
  const imageGenerationAvailable = canUseImageGeneration(
    isAdmin ? "admin" : "user",
    imageGenerationEnabled,
  );
  const [toolbarOpen, setToolbarOpen] = useState<
    "reverse" | "img2img" | "size" | null
  >(null);
  const barRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!openImageToImage) return;
    setToolbarOpen("img2img");
    onImageToImageOpened?.();
  }, [onImageToImageOpened, openImageToImage]);

  useEffect(() => {
    if (!toolbarOpen) return;
    lockPageScroll();
    return unlockPageScroll;
  }, [toolbarOpen]);

  // 上报输入条高度（含键盘补偿），供结果区预留空间
  useEffect(() => {
    const el = barRef.current;
    if (!el || !onHeightChange) return;
    const report = () => onHeightChange(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange, keyboardInset]);

  function toggleToolbar(panel: "reverse" | "img2img" | "size") {
    setToolbarOpen((prev) => (prev === panel ? null : panel));
  }

  const selectedSizeLabel =
    sizeOptions.find((option) => option.value === size)?.label || size;

  function autoResize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  function handleGenerate() {
    const p = prompt.trim();
    if (!p || generating || !imageGenerationAvailable) return;
    onGenerate(p, size);
    setPrompt("");
    requestAnimationFrame(autoResize);
  }

  return (
    <div
      ref={barRef}
      className="mobile-composer-shell md:hidden fixed z-40"
      style={{
        bottom: keyboardOpen
          ? "0px"
          : "var(--mobile-bottom-nav-height, 0px)",
      }}
    >
      {toolbarOpen ? (
        <div
          className="mobile-creation-overlay"
          onClick={() => setToolbarOpen(null)}
          aria-hidden="true"
        />
      ) : null}

      {toolbarOpen ? (
        <section
          id="mobile-creation-sheet"
          className="mobile-creation-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={
            toolbarOpen === "img2img"
              ? "图生图设置"
              : toolbarOpen === "reverse"
                ? "反推设置"
                : "画幅比例"
          }
        >
          <div className="mobile-creation-sheet__header">
            <span className="mobile-creation-sheet__handle" aria-hidden="true" />
            <div>
              <span className="ui-kicker">
                {toolbarOpen === "img2img"
                  ? "图生图"
                  : toolbarOpen === "reverse"
                    ? "反推"
                    : "画幅比例"}
              </span>
              <p className="mobile-creation-sheet__subtitle">
                {toolbarOpen === "img2img"
                  ? "素材、指令和生成设置"
                  : toolbarOpen === "reverse"
                    ? "上传图片分析提示词"
                    : "选择适合当前图片的比例"}
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
                draft={imageToImageDraft}
                sizeOptions={sizeOptions}
                generating={generating}
                disabled={!imageGenerationAvailable}
                onGenerate={onGenerate}
                onEditImage={onEditImage}
                onEditImageBatch={onEditImageBatch}
                onStopGenerate={onStopGenerate}
              />
            ) : (
              <div className="mobile-size-picker" role="listbox" aria-label="图片比例">
                {sizeOptions.map((option) => {
                  const selected = option.value === size;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={selected ? "is-active" : undefined}
                      onClick={() => {
                        setSize(option.value);
                        setToolbarOpen(null);
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="mobile-composer-tools">
        <button
          type="button"
          onClick={() => toggleToolbar("reverse")}
          aria-expanded={toolbarOpen === "reverse"}
          aria-controls="mobile-creation-sheet"
          className={
            toolbarOpen === "reverse"
              ? "mobile-composer-chip is-active"
              : "mobile-composer-chip"
          }
        >
          反推
        </button>
        <button
          type="button"
          onClick={() => toggleToolbar("img2img")}
          aria-expanded={toolbarOpen === "img2img"}
          aria-controls="mobile-creation-sheet"
          className={
            toolbarOpen === "img2img"
              ? "mobile-composer-chip is-active"
              : "mobile-composer-chip"
          }
        >
          图生图
        </button>
        <span className="mobile-composer-divider" aria-hidden="true" />
        <button
          type="button"
          onClick={() => toggleToolbar("size")}
          aria-expanded={toolbarOpen === "size"}
          aria-controls="mobile-creation-sheet"
          className={
            toolbarOpen === "size"
              ? "mobile-composer-size is-active"
              : "mobile-composer-size"
          }
        >
          {selectedSizeLabel}
          <span aria-hidden="true">⌄</span>
        </button>
      </div>

      {!imageGenerationAvailable ? (
        <p className="mobile-composer-alert">
          生图功能暂时关闭，反推提示词仍可使用
        </p>
      ) : null}

      {!toolbarOpen ? (
        <div className="mobile-composer-input-row">
          <div className="mobile-composer-input">
            <textarea
              ref={taRef}
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                autoResize();
              }}
              onFocus={autoResize}
              placeholder="描述你想要生成的图片…"
              rows={1}
              disabled={generating || !imageGenerationAvailable}
            />
          </div>
          <button
            type="button"
            onClick={generating ? onStopGenerate : handleGenerate}
            disabled={
              !generating &&
              (!prompt.trim() || !canAfford || !imageGenerationAvailable)
            }
            className={
              generating
                ? "mobile-composer-submit is-stopping"
                : "mobile-composer-submit"
            }
            aria-label={generating ? "停止生成" : "生成"}
          >
            {generating ? "■" : "↑"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
