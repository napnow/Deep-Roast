"use client";

import type { ImageRecord } from "@/types";

interface AdminImageDetailModalProps {
  image: ImageRecord;
  onClose: () => void;
}

export default function AdminImageDetailModal({
  image,
  onClose,
}: AdminImageDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-up"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.imageUrl}
          alt={image.prompt}
          className="w-full max-h-[60vh] object-contain"
          style={{ background: "var(--bg-root)" }}
        />
        <div className="p-5 space-y-3">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              📝 提示词
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-primary)" }}
            >
              {image.prompt}
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-2 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            <div>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                模型
              </span>
              <p>{image.model}</p>
            </div>
            <div>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                尺寸
              </span>
              <p>{image.size}</p>
            </div>
            {image.createdAt && (
              <div className="col-span-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  生成时间
                </span>
                <p>
                  {new Date(image.createdAt).toLocaleString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              关闭
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(image.prompt)}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-150"
              style={{
                background: "var(--accent-surface)",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
              }}
            >
              📋 复制提示词
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
