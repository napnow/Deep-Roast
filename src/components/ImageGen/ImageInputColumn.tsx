"use client";

import { useState } from "react";
import { IMAGE_STYLE_PRESETS, CREDIT_PER_IMAGE } from "@/types";
import ReversePromptPanel from "./ReversePromptPanel";
import Img2ImgPanel from "./Img2ImgPanel";

interface ImageInputColumnProps {
  prompt: string;
  setPrompt: (v: string) => void;
  size: string;
  setSize: (v: string) => void;
  sizeOptions: { value: string; label: string }[];
  generating: boolean;
  credits: number;
  /** admin 生图免费，不因余额禁用 */
  isAdmin?: boolean;
  checkinEligible?: boolean;
  todayChecked?: boolean;
  onGenerate: (prompt: string, size: string) => void;
  /** 图生图：原图直传编辑 */
  onEditImage?: (image: string, prompt: string, size: string) => void;
  onStopGenerate: () => void;
  onCheckinClick?: () => void;
  onWalletClick?: () => void;
}

const toolbarBtn =
  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 hover:scale-[1.02] active:scale-95";

export default function ImageInputColumn({
  prompt,
  setPrompt,
  size,
  setSize,
  sizeOptions,
  generating,
  credits,
  isAdmin = false,
  checkinEligible = false,
  todayChecked = false,
  onGenerate,
  onEditImage,
  onStopGenerate,
  onCheckinClick,
  onWalletClick,
}: ImageInputColumnProps) {
  const canAfford = isAdmin || credits >= CREDIT_PER_IMAGE;
  const [toolbarOpen, setToolbarOpen] = useState<"reverse" | "img2img" | null>(
    null,
  );

  function toggleToolbar(panel: "reverse" | "img2img") {
    setToolbarOpen((prev) => (prev === panel ? null : panel));
  }

  function handleGenerate() {
    const p = prompt.trim();
    if (!p || generating) return;
    onGenerate(p, size);
    setPrompt("");
  }

  return (
    <div
      className="w-full md:w-1/4 md:min-w-[260px] border-b md:border-b-0 md:border-r overflow-y-auto flex flex-col shrink-0"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-root)",
      }}
    >
      <div className="flex items-center gap-2 px-5 pt-4 pb-2 shrink-0 flex-wrap">
        <span
          className="text-[10px] font-semibold tracking-widest uppercase mr-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          工具
        </span>
        <button
          onClick={() => toggleToolbar("reverse")}
          className={toolbarBtn}
          style={{
            background:
              toolbarOpen === "reverse"
                ? "var(--accent-surface)"
                : "var(--bg-surface)",
            border: `1px solid ${
              toolbarOpen === "reverse" ? "var(--accent)" : "var(--border)"
            }`,
            color:
              toolbarOpen === "reverse"
                ? "var(--accent)"
                : "var(--text-secondary)",
          }}
        >
          反推
        </button>
        <button
          onClick={() => toggleToolbar("img2img")}
          className={toolbarBtn}
          style={{
            background:
              toolbarOpen === "img2img"
                ? "var(--accent-surface)"
                : "var(--bg-surface)",
            border: `1px solid ${
              toolbarOpen === "img2img" ? "var(--accent)" : "var(--border)"
            }`,
            color:
              toolbarOpen === "img2img"
                ? "var(--accent)"
                : "var(--text-secondary)",
          }}
        >
          图生图
        </button>
      </div>

      {/* 工具面板：展开时隐藏文生图输入区，保证页面上只有一个输入框 */}
      <div
        className="overflow-hidden border-b shrink-0 transition-all duration-300 ease-in-out"
        style={{
          maxHeight: toolbarOpen ? "400px" : "0px",
          borderColor: toolbarOpen ? "var(--border)" : "transparent",
          background: "var(--bg-surface)",
        }}
      >
        <div className="px-5 py-4">
          {toolbarOpen === "reverse" && (
            <ReversePromptPanel
              disabled={generating}
              onPrompt={setPrompt}
            />
          )}
          {toolbarOpen === "img2img" && (
            <Img2ImgPanel
              size={size}
              generating={generating}
              onGenerate={onGenerate}
              onEditImage={onEditImage}
              onStopGenerate={onStopGenerate}
            />
          )}
        </div>
      </div>

      {/* 文生图输入区：工具面板展开时隐藏（模式互斥，避免双输入框） */}
      {!toolbarOpen && (
      <div className="p-5 space-y-4">
        <label
          className="text-[11px] font-semibold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          描述你想要生成的图片
        </label>

        <div className="flex flex-wrap gap-1.5">
          {IMAGE_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setPrompt(preset.prompt)}
              disabled={generating}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-40 disabled:scale-100"
              style={{
                background:
                  prompt === preset.prompt && preset.prompt
                    ? "var(--accent-surface)"
                    : "var(--bg-surface)",
                border: `1px solid ${
                  prompt === preset.prompt && preset.prompt
                    ? "var(--accent)"
                    : "var(--border)"
                }`,
                color:
                  prompt === preset.prompt && preset.prompt
                    ? "var(--accent)"
                    : "var(--text-muted)",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：一只可爱的小猫在樱花树下晒太阳，日系动漫风格"
          rows={5}
          disabled={generating}
          className="w-full rounded-2xl px-4 py-3 text-sm resize-none transition-all duration-200 disabled:opacity-40"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />

        <div className="flex items-center gap-2">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 cursor-pointer flex-1"
            style={{
              background: "var(--bg-surface)",
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

          <button
            onClick={generating ? onStopGenerate : handleGenerate}
            disabled={!generating && (!prompt.trim() || !canAfford)}
            className="rounded-xl px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:scale-100 whitespace-nowrap"
            style={
              generating
                ? {
                    background: "var(--danger-surface)",
                    border: "1px solid var(--danger)",
                    color: "var(--danger)",
                  }
                : {
                    background: "var(--accent-surface)",
                    border: `1px solid ${
                      prompt.trim() && canAfford
                        ? "var(--accent)"
                        : "var(--border)"
                    }`,
                    color: "var(--accent)",
                  }
            }
          >
            {generating ? "⏹ 停止" : !canAfford ? "积分不足" : "生成"}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {isAdmin
              ? "管理员生图免费"
              : `每张图消耗 ${CREDIT_PER_IMAGE} 积分 · 余额 ${credits} · 可生成 ${Math.floor(credits / CREDIT_PER_IMAGE)} 张`}
          </p>
          {!isAdmin && (
            <button
              onClick={() => {
                if (checkinEligible && !todayChecked && onCheckinClick) {
                  onCheckinClick();
                } else if (onWalletClick) {
                  onWalletClick();
                }
              }}
              className="text-[10px] font-medium transition-all duration-150 hover:scale-105 shrink-0"
              style={{
                color: credits <= 40 ? "var(--danger)" : "var(--accent)",
              }}
            >
              {!canAfford
                ? checkinEligible && !todayChecked
                  ? "去签到 →"
                  : "查看钱包 →"
                : credits <= 40
                  ? checkinEligible && !todayChecked
                    ? "余额偏低，签到 →"
                    : "查看钱包 →"
                  : "钱包"}
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
