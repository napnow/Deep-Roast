"use client";

import type { ImageRecord } from "@/types";

interface ImageHistoryPanelProps {
  history: ImageRecord[];
  activeImage: ImageRecord | null;
  onSelect: (item: ImageRecord) => void;
  onDelete: (id: string) => void;
}

export default function ImageHistoryPanel({
  history,
  activeImage,
  onSelect,
  onDelete,
}: ImageHistoryPanelProps) {
  return (
    <div
      className="w-1/4 min-w-[220px] border-l overflow-y-auto p-4 space-y-3"
      style={{
        background: "var(--bg-root)",
        borderColor: "var(--border)",
      }}
    >
      <h3
        className="text-[11px] font-semibold tracking-widest uppercase mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        历史记录
      </h3>

      {history.length === 0 && (
        <div className="text-center mt-12">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            暂无记录
          </p>
        </div>
      )}

      {history.map((item) => {
        const isActive = activeImage?.id === item.id;
        return (
          <div key={item.id} className="group relative">
            <button
              onClick={() => onSelect(item)}
              className="w-full text-left rounded-xl overflow-hidden border transition-all duration-200 hover:scale-[1.01]"
              style={{
                borderColor: isActive ? "var(--accent)" : "var(--border)",
                boxShadow: isActive ? "var(--shadow-md)" : "none",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.prompt}
                className="w-full h-32 object-cover"
                loading="lazy"
              />
              <div
                className="p-2.5"
                style={{ background: "var(--bg-surface)" }}
              >
                <p
                  className="text-[11px] leading-snug truncate"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {item.prompt}
                </p>
                <p
                  className="text-[10px] mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("删除这张图片？")) onDelete(item.id);
              }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all duration-150 hover:scale-110"
              style={{
                background: "var(--danger)",
                color: "#fff",
              }}
              title="删除"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
