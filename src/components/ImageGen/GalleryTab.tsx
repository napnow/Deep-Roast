"use client";

import { useState } from "react";
import type { ImageRecord } from "@/types";
import { thumbSrc } from "./imageUtils";
import ConfirmDialog from "@/components/ConfirmDialog";

interface GalleryTabProps {
  history: ImageRecord[];
  onPreview: (item: ImageRecord) => void;
  onDelete: (id: string) => void;
}

/** 手机端「图库」Tab：历史图片网格，点击预览、可删除 */
export default function GalleryTab({
  history,
  onPreview,
  onDelete,
}: GalleryTabProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-20">
          <p
            className="font-display text-3xl opacity-40"
            style={{ color: "var(--accent)" }}
          >
            焙
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            还没有生图记录，去「生成」页试试
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="relative rounded-xl overflow-hidden border"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                onClick={() => onPreview(item)}
                className="block w-full aspect-square"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbSrc(item)}
                  alt={item.prompt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
              <p
                className="absolute bottom-0 inset-x-0 px-2 py-1.5 text-[10px] truncate"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.72), transparent)",
                  color: "#f5e6d3",
                }}
              >
                {item.prompt}
              </p>
              <button
                onClick={() => {
                  setPendingDeleteId(item.id);
                  setConfirmOpen(true);
                }}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px]"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                }}
                title="删除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="删除图片"
        message="确定删除这张图片？此操作不可撤销。"
        confirmText="删除"
        onConfirm={() => {
          if (pendingDeleteId) onDelete(pendingDeleteId);
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
