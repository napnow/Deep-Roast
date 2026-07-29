"use client";

import type { ImageRecord } from "@/types";

interface AdminImagesTabProps {
  images: ImageRecord[];
  onSelect: (img: ImageRecord) => void;
}

export default function AdminImagesTab({
  images,
  onSelect,
}: AdminImagesTabProps) {
  return (
    <section>
      <h2
        className="text-sm font-semibold mb-3"
        style={{ color: "var(--text-secondary)" }}
      >
        图片生成记录 ({images.length})
      </h2>
      {images.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          暂无图片
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((img) => (
            <button
              key={img.id}
              onClick={() => onSelect(img)}
              className="rounded-xl border overflow-hidden transition-all duration-150 hover:scale-[1.02] active:scale-95"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
              }}
            >
              <div className="aspect-square overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageUrl}
                  alt={img.prompt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-2">
                <p
                  className="text-[10px] truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {img.createdAt
                    ? new Date(img.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
