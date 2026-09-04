"use client";

import { useState } from "react";
import type { ImageRecord } from "@/types";
import { downloadImage } from "./imageUtils";
import ConfirmDialog from "@/components/ConfirmDialog";

interface ImagePreviewModalProps {
  image: ImageRecord | null;
  onClose: () => void;
  onContinueEditing: (image: ImageRecord) => void;
  onDelete: (id: string) => void;
}

/** 大图预览弹窗：下载 / 复制提示词 / 删除 */
export default function ImagePreviewModal({
  image,
  onClose,
  onContinueEditing,
  onDelete,
}: ImagePreviewModalProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={onClose}
    >
      {/* 顶部操作条 */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "#f5e6d3" }}>
            {image.model} · {image.size}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 hover:scale-110"
          style={{ color: "#f5e6d3" }}
          aria-label="关闭"
        >
          ✕
        </button>
      </div>

      {/* 大图 */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.imageUrl}
          alt={image.prompt}
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* 底部操作区 */}
      <div
        className="shrink-0 px-4 pb-5 pt-3 space-y-2"
        style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="text-[12px] leading-relaxed max-h-16 overflow-y-auto"
          style={{ color: "rgba(245,230,211,0.85)" }}
        >
          {image.prompt}
        </p>
        <p className="text-[10px]" style={{ color: "rgba(245,230,211,0.5)" }}>
          {new Date(image.createdAt).toLocaleString("zh-CN")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onContinueEditing(image)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95"
            style={{
              background: "var(--accent)",
              color: "var(--accent-on)",
            }}
          >
            继续修改
          </button>
          <button
            onClick={() => downloadImage(image)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 active:scale-95"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#f5e6d3",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            下载
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(image.prompt)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 active:scale-95"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "#f5e6d3",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            复制提示词
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 active:scale-95"
            style={{
              background: "rgba(201,68,60,0.15)",
              color: "#e8827b",
              border: "1px solid rgba(201,68,60,0.35)",
            }}
          >
            删除
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="删除图片"
        message="确定删除这张图片？此操作不可撤销。"
        confirmText="删除"
        onConfirm={() => {
          onDelete(image.id);
          onClose();
        }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
