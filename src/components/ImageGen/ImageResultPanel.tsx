"use client";

import type { ImageRecord } from "@/types";
import { downloadImage, formatTime } from "./imageUtils";
import SmartResultImage from "./SmartResultImage";

interface ImageResultPanelProps {
  activeImage: ImageRecord | null;
  generating: boolean;
  elapsedSeconds: number;
  lastGenTime: number | null;
  /** 清除结果区（回到空状态） */
  onClear?: () => void;
}

export default function ImageResultPanel({
  activeImage,
  generating,
  elapsedSeconds,
  lastGenTime,
  onClear,
}: ImageResultPanelProps) {
  return (
    <div className="dr-canvas flex-1 md:flex-[2] overflow-y-auto p-4 md:p-6 flex items-center justify-center min-h-0">
      {activeImage ? (
        <div className="relative w-full max-w-xl max-h-full overflow-auto animate-bake-done">
          {/* 关闭按钮：清除结果区，不影响历史记录 */}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="关闭预览"
              className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center text-[13px] transition-all duration-150 hover:scale-110 active:scale-95"
              style={{
                background: "rgba(0,0,0,0.55)",
                color: "#f5e6d3",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            >
              ✕
            </button>
          )}
          <div
            className="rounded-xl overflow-hidden border"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-strong)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <SmartResultImage
              record={activeImage}
              className="w-full"
              style={{ background: "var(--bg-root)", height: "auto" }}
            />
            <div className="p-4 space-y-2">
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {activeImage.prompt}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {activeImage.model} · {activeImage.size}
                  {lastGenTime != null && (
                    <span> · 耗时 {formatTime(lastGenTime)}</span>
                  )}
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => downloadImage(activeImage)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-150 active:scale-95"
                    style={{
                      background: "var(--accent)",
                      color: "var(--accent-on)",
                    }}
                    title="下载图片"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    下载
                  </button>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(activeImage.prompt)
                    }
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-95"
                    style={{
                      background: "var(--bg-elevated)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border)",
                    }}
                    title="复制提示词"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    复制
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : generating ? (
        <div
          className="w-full max-w-xl rounded-xl border flex items-center justify-center h-64 animate-ember"
          style={{
            borderColor:
              "color-mix(in srgb, var(--accent) 45%, var(--border))",
            background: "var(--bg-surface)",
          }}
        >
          <div className="text-center space-y-3">
            <div className="flex gap-2 justify-center">
              {[0, 120, 240].map((delay) => (
                <span
                  key={delay}
                  className="w-2 h-2 rounded-full animate-pulse-soft"
                  style={{
                    background: "var(--accent)",
                    animationDelay: `${delay}ms`,
                  }}
                />
              ))}
            </div>
            <p
              className="text-sm font-semibold tabular-nums"
              style={{ color: "var(--accent)" }}
            >
              焙制中 · {formatTime(elapsedSeconds)}
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              好图需要一点火候
            </p>
          </div>
        </div>
      ) : (
        <div
          className="w-full max-w-xl rounded-xl border border-dashed flex flex-col items-center justify-center h-52 gap-2"
          style={{
            borderColor: "var(--border-strong)",
            background:
              "color-mix(in srgb, var(--bg-surface) 80%, transparent)",
          }}
        >
          <p
            className="font-display text-3xl opacity-40"
            style={{ color: "var(--accent)" }}
          >
            焙
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            <span className="md:hidden">底部输入提示词，舞台在此出图</span>
            <span className="hidden md:inline">
              左侧写下提示词，舞台在此出图
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
