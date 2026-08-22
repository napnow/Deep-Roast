"use client";

import { useEffect, useRef, useState } from "react";
import { CREDIT_PER_IMAGE } from "@/types";
import { lockPageScroll, unlockPageScroll } from "@/lib/scroll-lock";
import { canUseImageGeneration } from "@/lib/image-generation-access";
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
}

/** iOS 键盘弹出高度（overlay 键盘时 visualViewport 收缩） */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const diff = Math.max(0, (window.innerHeight || 0) - vv.height);
      setInset(diff);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/**
 * 手机端底部输入条（ChatGPT 风格，fixed 定位）：
 * - fixed 固定在视口底部，键盘弹出时自动顶在键盘上方（visualViewport 补偿），
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
}: ImageMobileBarProps) {
  const canAfford = isAdmin || credits >= CREDIT_PER_IMAGE;
  const imageGenerationAvailable = canUseImageGeneration(
    isAdmin ? "admin" : "user",
    imageGenerationEnabled,
  );
  const [toolbarOpen, setToolbarOpen] = useState<"reverse" | "img2img" | null>(
    null,
  );
  const kbInset = useKeyboardInset();
  const barRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
  }, [onHeightChange, kbInset]);

  function toggleToolbar(panel: "reverse" | "img2img") {
    setToolbarOpen((prev) => (prev === panel ? null : panel));
  }

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
      style={{ bottom: kbInset }}
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
          aria-label={toolbarOpen === "img2img" ? "图生图设置" : "反推设置"}
        >
          <div className="mobile-creation-sheet__header">
            <span className="mobile-creation-sheet__handle" aria-hidden="true" />
            <div>
              <span className="ui-kicker">
                {toolbarOpen === "img2img" ? "图生图" : "反推"}
              </span>
              <p className="mobile-creation-sheet__subtitle">
                {toolbarOpen === "img2img"
                  ? "素材、指令和生成设置"
                  : "上传图片分析提示词"}
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
            ) : (
              <Img2ImgPanel
                size={size}
                sizeOptions={sizeOptions}
                generating={generating}
                disabled={!imageGenerationAvailable}
                onGenerate={onGenerate}
                onEditImage={onEditImage}
                onEditImageBatch={onEditImageBatch}
                onStopGenerate={onStopGenerate}
              />
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
        <label className="mobile-composer-size">
          <span className="sr-only">图片比例</span>
          <select
            value={size}
            onChange={(event) => setSize(event.target.value)}
            aria-label="图片比例"
          >
            {sizeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
              onFocus={() => {
                autoResize();
                lockPageScroll();
              }}
              onBlur={unlockPageScroll}
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
