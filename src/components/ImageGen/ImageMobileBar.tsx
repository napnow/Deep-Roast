"use client";

import { useEffect, useRef, useState } from "react";
import { CREDIT_PER_IMAGE } from "@/types";
import { lockPageScroll, unlockPageScroll } from "@/lib/scroll-lock";
import ReversePromptPanel from "./ReversePromptPanel";
import Img2ImgPanel from "./Img2ImgPanel";

interface ImageMobileBarProps {
  prompt: string;
  setPrompt: (v: string) => void;
  size: string;
  setSize: (v: string) => void;
  sizeOptions: { value: string; label: string }[];
  generating: boolean;
  credits: number;
  isAdmin?: boolean;
  onGenerate: (prompt: string, size: string) => void;
  /** 图生图：原图直传编辑，支持多张参考图（最多 5 张） */
  onEditImage?: (images: string[], prompt: string, size: string) => void;
  /** 图生图批量：最多 5 张 */
  onEditImageBatch?: (
    images: string[],
    prompt: string,
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
  onGenerate,
  onEditImage,
  onEditImageBatch,
  onStopGenerate,
  onHeightChange,
}: ImageMobileBarProps) {
  const canAfford = isAdmin || credits >= CREDIT_PER_IMAGE;
  const [toolbarOpen, setToolbarOpen] = useState<"reverse" | "img2img" | null>(
    null,
  );
  const kbInset = useKeyboardInset();
  const barRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
    if (!p || generating) return;
    onGenerate(p, size);
    setPrompt("");
    requestAnimationFrame(autoResize);
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "var(--accent-surface)" : "var(--bg-root)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    color: active ? "var(--accent)" : "var(--text-secondary)",
  });

  return (
    <div
      ref={barRef}
      className="md:hidden fixed z-30"
      style={{
        left: 0,
        right: 0,
        bottom: kbInset,
        borderTop: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--bg-elevated) 82%, transparent)",
        backdropFilter: "blur(14px) saturate(1.2)",
        WebkitBackdropFilter: "blur(14px) saturate(1.2)",
        transition: "bottom 0.22s ease",
      }}
    >
      {/* 工具面板：展开时盖在结果区上方 */}
      {toolbarOpen && (
        <div className="relative border-b" style={{ borderColor: "var(--border)" }}>
          <div
            className="overflow-y-auto overflow-x-hidden px-4 py-3"
            style={{ maxHeight: "60vh", background: "var(--bg-surface)" }}
          >
            {toolbarOpen === "reverse" && (
              <ReversePromptPanel
                disabled={generating}
                onPrompt={setPrompt}
                onCloseToolbar={() => setToolbarOpen(null)}
              />
            )}
            {toolbarOpen === "img2img" && (
              <Img2ImgPanel
                size={size}
                sizeOptions={sizeOptions}
                generating={generating}
                onGenerate={onGenerate}
                onEditImage={onEditImage}
                onEditImageBatch={onEditImageBatch}
                onStopGenerate={onStopGenerate}
              />
            )}
          </div>
        </div>
      )}

      {/* 工具行 */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 overflow-x-auto">
        <button
          onClick={() => toggleToolbar("reverse")}
          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150 active:scale-95"
          style={chipStyle(toolbarOpen === "reverse")}
        >
          反推
        </button>
        <button
          onClick={() => toggleToolbar("img2img")}
          className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150 active:scale-95"
          style={chipStyle(toolbarOpen === "img2img")}
        >
          图生图
        </button>
        <span
          className="w-px h-4 shrink-0"
          style={{ background: "var(--border-strong)" }}
        />
        <select
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="shrink-0 rounded-full px-3 py-1.5 text-base cursor-pointer transition-colors duration-200"
          style={{
            background: "var(--bg-root)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          {sizeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 输入行：工具面板展开时隐藏（面板内有自己的输入框，避免双输入框） */}
      {!toolbarOpen && (
      <div className="flex items-end gap-2 px-3 pb-3">
        <div
          className="flex-1 min-w-0 flex items-end rounded-2xl border transition-colors duration-200"
          style={{
            background: "var(--bg-root)",
            borderColor: prompt.trim()
              ? "color-mix(in srgb, var(--accent) 45%, var(--border))"
              : "var(--border)",
          }}
        >
          <textarea
            ref={taRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              autoResize();
            }}
            onFocus={() => {
              autoResize();
              lockPageScroll();
            }}
            onBlur={unlockPageScroll}
            placeholder="描述你想要生成的图片…"
            rows={1}
            disabled={generating}
            className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-base resize-none max-h-[120px] outline-none disabled:opacity-40"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <button
          onClick={generating ? onStopGenerate : handleGenerate}
          disabled={!generating && (!prompt.trim() || !canAfford)}
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 disabled:opacity-30 disabled:scale-100"
          style={
            generating
              ? {
                  background: "var(--danger-surface)",
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                }
              : {
                  background: "linear-gradient(135deg, var(--accent-soft), var(--accent))",
                  color: "var(--accent-on)",
                  boxShadow: "0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent)",
                }
          }
          aria-label={generating ? "停止生成" : "生成"}
        >
          {generating ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>
      )}
    </div>
  );
}
