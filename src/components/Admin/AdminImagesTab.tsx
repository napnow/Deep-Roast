"use client";

import type { ImageRecord } from "@/types";
import { thumbSrc } from "@/components/ImageGen/imageUtils";

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
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="admin-kicker">Gallery</p>
          <h2 className="admin-title text-base mt-1">图片生成记录</h2>
        </div>
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--text-muted)" }}
        >
          {images.length}
        </span>
      </div>

      {images.length === 0 ? (
        <div
          className="rounded-[var(--radius-lg)] px-4 py-10 text-center text-xs"
          style={{
            background: "var(--bg-surface)",
            border: "1px dashed var(--border-strong)",
            color: "var(--text-muted)",
          }}
        >
          暂无图片
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => onSelect(img)}
              className="admin-card overflow-hidden text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="aspect-square overflow-hidden"
                style={{ background: "var(--bg-root)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbSrc(img)}
                  alt={img.prompt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="px-2.5 py-2">
                <p
                  className="text-[10px] tabular-nums"
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
                {img.prompt && (
                  <p
                    className="text-[10.5px] mt-0.5 line-clamp-2 leading-snug"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {img.prompt}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
