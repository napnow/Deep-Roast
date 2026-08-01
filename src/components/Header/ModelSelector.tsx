"use client";

import { useState, useRef, useEffect } from "react";
import type { ModelInfo } from "@/types";

interface ModelSelectorProps {
  activeMode: "text" | "image";
  currentModel: string;
  models: ModelInfo[];
  onModelChange: (model: string) => void;
  onModelRemove?: (model: string) => void;
}

export default function ModelSelector({
  activeMode,
  currentModel,
  models,
  onModelChange,
  onModelRemove,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium max-w-[120px] sm:max-w-[220px] transition-all duration-200"
        style={{
          background: "var(--bg-root)",
          border: `1px solid ${open ? "var(--accent-soft)" : "var(--border)"}`,
          color: "var(--text-secondary)",
        }}
      >
        <span className="truncate">{currentModel || "选择模型"}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-72 rounded-xl border shadow-lg py-1.5 z-30 animate-scale-in overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div
            className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest flex items-center justify-between"
            style={{ color: "var(--text-muted)" }}
          >
            <span>
              {activeMode === "text" ? "文生文模型" : "文生图模型"}
            </span>
            <span className="normal-case tracking-normal font-normal">
              已启用 {models.length}
            </span>
          </div>

          {models.length === 0 ? (
            <div
              className="px-3 py-4 text-xs text-center"
              style={{ color: "var(--text-muted)" }}
            >
              暂无启用模型，请到设置中添加
            </div>
          ) : (
            models.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-1 pr-1"
                style={{
                  background:
                    m.id === currentModel
                      ? "var(--accent-surface)"
                      : "transparent",
                }}
              >
                <button
                  onClick={() => {
                    onModelChange(m.id);
                    setOpen(false);
                  }}
                  className="flex-1 min-w-0 text-left px-3 py-2 text-xs transition-colors duration-100 flex items-center gap-2"
                  style={{
                    color:
                      m.id === currentModel
                        ? "var(--accent)"
                        : "var(--text-secondary)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background:
                        m.id === currentModel ? "var(--accent)" : "transparent",
                    }}
                  />
                  <span className="truncate font-mono text-[11px]">{m.id}</span>
                </button>
                {onModelRemove && models.length > 1 && (
                  <button
                    type="button"
                    title="从启用列表移除"
                    onClick={(e) => {
                      e.stopPropagation();
                      onModelRemove(m.id);
                    }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] shrink-0 hover:opacity-80"
                    style={{ color: "var(--danger)" }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}

          <div
            className="px-3 py-1.5 text-[10px] border-t"
            style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
          >
            在设置里「获取模型」可添加更多
          </div>
        </div>
      )}
    </div>
  );
}
