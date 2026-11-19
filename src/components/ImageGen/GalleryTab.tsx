"use client";

import { useState } from "react";
import type { ImageRecord } from "@/types";
import { thumbSrc } from "./imageUtils";
import ConfirmDialog from "@/components/ConfirmDialog";

interface GalleryTabProps {
  history: ImageRecord[];
  onPreview: (item: ImageRecord) => void;
  onDelete: (id: string) => void;
  onBatchDelete: (ids: string[], mode: "selected" | "version-group") => Promise<string[]>;
}

/** 手机端「图库」Tab：历史图片网格，点击预览、可删除 */
export default function GalleryTab({
  history,
  onPreview,
  onDelete,
  onBatchDelete,
}: GalleryTabProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState<"selected" | "version-group" | null>(null);
  const selectedImages = history.filter((image) => selectedIds.has(image.id));
  const selectedGroups = new Set(selectedImages.map((image) => image.versionGroupId).filter(Boolean));
  const selectedGroupId = selectedGroups.size === 1 ? [...selectedGroups][0] : null;
  const selectedGroupSize = selectedGroupId ? history.filter((image) => image.versionGroupId === selectedGroupId).length : 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        {!selecting ? <button type="button" onClick={() => setSelecting(true)}>选择</button> : <><button type="button" onClick={() => setSelectedIds(new Set(history.map((image) => image.id)))}>全选</button><span aria-live="polite">已选 {selectedImages.length} 张</span><button type="button" onClick={() => { setSelecting(false); setSelectedIds(new Set()); }}>取消</button><button type="button" disabled={!selectedImages.length} onClick={() => setBatchMode("selected")}>删除选中</button><button type="button" disabled={!selectedGroupId} onClick={() => setBatchMode("version-group")}>删除版本组</button></>}
      </div>
      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-20">
          <p
            className="font-display text-3xl opacity-40 text-[var(--accent)]"
          >
            焙
          </p>
          <p className="text-xs text-[var(--text-muted)]">
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
              {selecting && <button type="button" className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full bg-white/90 text-xs" aria-label={`选择图片：${item.prompt}`} aria-pressed={selectedIds.has(item.id)} onClick={() => setSelectedIds((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })}>{selectedIds.has(item.id) ? "✓" : ""}</button>}
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
      <ConfirmDialog
        open={!!batchMode}
        title={batchMode === "version-group" ? "删除整个版本组" : "删除选中图片"}
        message={batchMode === "version-group" ? `将删除该版本组的全部图片（共 ${selectedGroupSize} 张，含未显示的其他版本），此操作不可撤销。` : `将删除已选中的 ${selectedImages.length} 张图片，其他版本不会受影响。`}
        confirmText="确认删除"
        onConfirm={async () => {
          if (batchMode === "version-group" && selectedGroupId) await onBatchDelete([selectedGroupId], batchMode);
          if (batchMode === "selected") await onBatchDelete(selectedImages.map((image) => image.id), batchMode);
          setBatchMode(null); setSelecting(false); setSelectedIds(new Set());
        }}
        onClose={() => setBatchMode(null)}
      />
    </div>
  );
}
