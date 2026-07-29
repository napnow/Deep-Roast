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
      className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in"
      style={{ background: "rgba(18, 14, 10, 0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="rounded-[var(--radius-xl)] border max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-up"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
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
        <div className="p-5 space-y-4">
          <div>
            <p className="admin-kicker mb-1.5">Prompt</p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-primary)" }}
            >
              {image.prompt}
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-3 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            <div>
              <span className="admin-kicker">模型</span>
              <p className="mt-1 font-medium">{image.model}</p>
            </div>
            <div>
              <span className="admin-kicker">尺寸</span>
              <p className="mt-1 font-medium tabular-nums">{image.size}</p>
            </div>
            {image.createdAt && (
              <div className="col-span-2">
                <span className="admin-kicker">生成时间</span>
                <p className="mt-1 tabular-nums">
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
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="admin-btn admin-btn--ghost flex-1"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(image.prompt)}
              className="admin-btn admin-btn--accent flex-1"
            >
              复制提示词
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
