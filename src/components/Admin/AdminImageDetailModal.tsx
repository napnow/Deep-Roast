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
    <div className="fixed inset-0 z-50 animate-fade-in">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(18, 14, 10, 0.55)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />
      <div
        className="relative z-10 flex h-full items-center justify-center overflow-y-auto p-3 sm:p-6"
        onClick={onClose}
      >
        <div
          className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-xl)] border animate-fade-up sm:max-h-[calc(100vh-3rem)]"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            data-testid="admin-image-detail-media"
            className="flex min-h-[30vh] flex-1 items-center justify-center overflow-hidden p-2 sm:min-h-[40vh] sm:p-4"
            style={{ background: "var(--bg-root)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.imageUrl}
              alt={image.prompt}
              className="max-h-[55vh] max-w-full object-contain sm:max-h-[60vh]"
            />
          </div>
          <div
            data-testid="admin-image-detail-info"
            className="max-h-[42vh] shrink-0 space-y-4 overflow-y-auto border-t p-4 sm:p-5"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="rounded-[var(--radius)] border p-3"
              style={{
                background: "var(--bg-root)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="admin-kicker">Prompt</p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(image.prompt)}
                  className="admin-btn admin-btn--accent !px-2 !py-1 text-xs"
                >
                  复制提示词
                </button>
              </div>
              <p
                className="mt-2 max-h-[24vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed"
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
            <button
              type="button"
              onClick={onClose}
              className="admin-btn admin-btn--ghost w-full"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
