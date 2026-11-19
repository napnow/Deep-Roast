"use client";

import { useMemo, useState, useEffect } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Button from "@/components/ui/Button";
import { useActionFeedback } from "@/hooks/useActionFeedback";
import type { ImageRecord } from "@/types";
import { AppIcon } from "@/components/ui/icons";
import { useDeepRoastStore } from "@/lib/store";
import {
  filterImages,
  groupImagesByDate,
  mergeImageSourceModes,
  reuseParametersFromImage,
  type ImageFilterMode,
} from "@/lib/image-library";
import { downloadImage } from "./imageUtils";
import ImageActionMenu from "./ImageActionMenu";

interface AssetInspectorProps {
  forceExpanded?: boolean;
  onClose?: () => void;
  history: ImageRecord[];
  activeImage: ImageRecord | null;
  onSelect: (image: ImageRecord) => void;
  onContinueEditing: (image: ImageRecord) => void;
  onDelete: (id: string) => void;
  onBatchDelete: (ids: string[], mode: "selected" | "version-group") => Promise<string[]>;
}

export default function AssetInspector({
  forceExpanded = false,
  onClose,
  history,
  activeImage,
  onSelect,
  onContinueEditing,
  onDelete,
  onBatchDelete,
}: AssetInspectorProps) {
  const {
    inspectorTab,
    inspectorCollapsed,
    setInspectorTab,
    setInspectorCollapsed,
    setTextToImageDraft,
    setImageCreationMode,
    setSelectedImageModel,
  } = useDeepRoastStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState<"selected" | "version-group" | null>(null);
  const epoch = useDeepRoastStore((state) => state.userSessionVersion);
  const download = useActionFeedback(`${activeImage?.id || ""}:download`);
  useEffect(() => {
    setDeleteId(null);
  }, [epoch]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ImageFilterMode>("all");
  const groups = useMemo(
    () =>
      groupImagesByDate(
        filterImages(mergeImageSourceModes(history, {}), query, filter),
      ),
    [filter, history, query],
  );
  const visibleImages = groups.flatMap((group) => group.images);
  const selectedImages = visibleImages.filter((image) => selectedIds.has(image.id));
  const selectedGroups = new Set(selectedImages.map((image) => image.versionGroupId).filter(Boolean));
  const selectedGroupId = selectedGroups.size === 1 ? [...selectedGroups][0] : null;
  const selectedGroupSize = selectedGroupId ? history.filter((image) => image.versionGroupId === selectedGroupId).length : 0;
  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const closeSelection = () => { setSelecting(false); setSelectedIds(new Set()); };

  if (inspectorCollapsed && !forceExpanded) {
    return (
      <section className="asset-inspector is-collapsed">
        <button
          className="icon-button"
          onClick={() => setInspectorCollapsed(false)}
          aria-label="展开素材检查器"
        >
          <AppIcon name="history" />
        </button>
      </section>
    );
  }

  const reuse = () => {
    if (!activeImage) return;
    const next = reuseParametersFromImage(activeImage);
    setTextToImageDraft({ prompt: next.prompt, size: next.size });
    setSelectedImageModel(next.model);
    setImageCreationMode("text");
  };

  return (
    <section className="asset-inspector">
      <header className="asset-inspector__header">
        <div className="asset-tabs" role="tablist" aria-label="素材检查器">
          {(["history", "details"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={inspectorTab === tab}
              className={inspectorTab === tab ? "is-active" : ""}
              onClick={() => setInspectorTab(tab)}
            >
              {tab === "history" ? "历史" : "详情"}
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          onClick={onClose ?? (() => setInspectorCollapsed(true))}
          aria-label={onClose ? "关闭作品库" : "收起素材检查器"}
        >
          <AppIcon name="close" />
        </button>
      </header>

      {inspectorTab === "history" ? (
        <div className="asset-inspector__body">
          <label className="asset-search">
            <AppIcon name="search" size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="搜索作品提示词"
              placeholder="搜索提示词"
            />
          </label>
          <div className="asset-filters">
            {(["all", "text", "edit"] as const).map((mode) => (
              <button
                key={mode}
                className={filter === mode ? "is-active" : ""}
                onClick={() => setFilter(mode)}
              >
                {mode === "all"
                  ? "全部"
                  : mode === "text"
                    ? "文生图"
                    : "图生图"}
              </button>
            ))}
          </div>
          <div className="asset-selection-toolbar">
            {!selecting ? (
              <button type="button" onClick={() => setSelecting(true)}>选择</button>
            ) : (
              <>
                <button type="button" onClick={() => setSelectedIds(new Set(visibleImages.map((image) => image.id)))}>全选</button>
                <span aria-live="polite">已选 {selectedImages.length} 张</span>
                <button type="button" onClick={closeSelection}>取消</button>
                <button type="button" disabled={!selectedImages.length} onClick={() => setBatchMode("selected")}>删除选中</button>
                <button type="button" disabled={!selectedGroupId} onClick={() => setBatchMode("version-group")}>删除版本组</button>
              </>
            )}
          </div>
          {groups.length ? (
            groups.map((group) => (
              <section className="asset-group" key={group.label}>
                <p>{group.label}</p>
                <div className="asset-grid">
                  {group.images.map((image) => (
                    <div className="asset-thumbnail" key={image.id}>
                      {selecting && <button type="button" className={`asset-thumbnail__check ${selectedIds.has(image.id) ? "is-selected" : ""}`} aria-label={`选择图片：${image.prompt}`} aria-pressed={selectedIds.has(image.id)} onClick={() => toggleSelected(image.id)}>{selectedIds.has(image.id) ? "✓" : ""}</button>}
                      <button
                        type="button"
                        className={`asset-thumbnail__select ${
                          activeImage?.id === image.id ? "is-active" : ""
                        }`}
                        onClick={() => onSelect(image)}
                        title={image.prompt}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.thumbUrl || image.imageUrl}
                          alt={image.prompt}
                        />
                      </button>
                      <button
                        type="button"
                        className="asset-thumbnail__delete"
                        aria-label={`删除图片：${image.prompt}`}
                        title="删除图片"
                        onClick={() => setDeleteId(image.id)}
                      >
                        <AppIcon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p className="asset-empty">没有匹配的图片</p>
          )}
        </div>
      ) : (
        <div className="asset-inspector__body">
          {activeImage ? (
            <div className="asset-details">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeImage.thumbUrl || activeImage.imageUrl}
                alt={activeImage.prompt}
              />
              <p className="asset-details__prompt">{activeImage.prompt}</p>
              <dl>
                <div>
                  <dt>模型</dt>
                  <dd>{activeImage.model}</dd>
                </div>
                <div>
                  <dt>尺寸</dt>
                  <dd>{activeImage.size}</dd>
                </div>
                <div>
                  <dt>时间</dt>
                  <dd>
                    {new Date(activeImage.createdAt).toLocaleString("zh-CN")}
                  </dd>
                </div>
              </dl>
              <div className="asset-details__actions">
                <button className="ui-button" onClick={reuse}>
                  <AppIcon name="copy" />
                  复用参数
                </button>
                <button
                  className="ui-button"
                  onClick={() => onContinueEditing(activeImage)}
                >
                  <AppIcon name="edit" />
                  继续修改
                </button>
                <Button
                  loading={download.status === "pending"}
                  onClick={() => {
                    void download.run(
                      (signal) => downloadImage(activeImage, signal),
                      "已发起下载",
                      "下载未完成，请检查网络后重试。",
                    );
                  }}
                >
                  <AppIcon name="download" />
                  {download.status === "success" ? "已发起下载" : "下载"}
                </Button>
                <ImageActionMenu onDelete={() => setDeleteId(activeImage.id)} />
              </div>
            </div>
          ) : (
            <p className="asset-empty">选择一张图片查看详情</p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!deleteId}
        title="删除图片"
        message="确定删除这张图片？删除后无法恢复。"
        confirmText="删除"
        onConfirm={() => {
          if (deleteId) onDelete(deleteId);
        }}
        onClose={() => setDeleteId(null)}
      />
      <ConfirmDialog
        open={!!batchMode}
        title={batchMode === "version-group" ? "删除整个版本组" : "删除选中图片"}
        message={batchMode === "version-group" ? `将删除该版本组的全部图片（共 ${selectedGroupSize} 张，含未显示的其他版本），此操作不可撤销。` : `将删除已选中的 ${selectedImages.length} 张图片，其他版本不会受影响。`}
        confirmText="确认删除"
        onConfirm={async () => {
          if (batchMode === "version-group" && selectedGroupId) await onBatchDelete([selectedGroupId], batchMode);
          if (batchMode === "selected") await onBatchDelete(selectedImages.map((image) => image.id), batchMode);
          setBatchMode(null);
          closeSelection();
        }}
        onClose={() => setBatchMode(null)}
      />
    </section>
  );
}
