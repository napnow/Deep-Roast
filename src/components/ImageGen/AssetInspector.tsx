"use client";

import { useMemo, useState } from "react";
import type { ImageRecord } from "@/types";
import { AppIcon } from "@/components/ui/icons";
import { useDeepRoastStore } from "@/lib/store";
import {
  confirmedImageDeletionId,
  filterImages,
  groupImagesByDate,
  mergeImageSourceModes,
  reuseParametersFromImage,
  type ImageFilterMode,
} from "@/lib/image-library";
import { downloadImage } from "./imageUtils";
import ImageActionMenu from "./ImageActionMenu";

interface AssetInspectorProps {
  history: ImageRecord[];
  activeImage: ImageRecord | null;
  onSelect: (image: ImageRecord) => void;
  onDelete: (id: string) => void;
}

export default function AssetInspector({
  history,
  activeImage,
  onSelect,
  onDelete,
}: AssetInspectorProps) {
  const {
    inspectorTab,
    inspectorCollapsed,
    setInspectorTab,
    setInspectorCollapsed,
    setTextToImageDraft,
    setImageToImageDraft,
    setImageCreationMode,
    setSelectedImageModel,
  } = useDeepRoastStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ImageFilterMode>("all");
  const groups = useMemo(
    () => groupImagesByDate(filterImages(mergeImageSourceModes(history, {}), query, filter)),
    [filter, history, query],
  );

  if (inspectorCollapsed) {
    return (
      <aside className="asset-inspector is-collapsed">
        <button
          className="icon-button"
          onClick={() => setInspectorCollapsed(false)}
          aria-label="展开素材检查器"
        >
          <AppIcon name="history" />
        </button>
      </aside>
    );
  }

  const reuse = () => {
    if (!activeImage) return;
    const next = reuseParametersFromImage(activeImage);
    setTextToImageDraft({ prompt: next.prompt, size: next.size });
    setSelectedImageModel(next.model);
    setImageCreationMode("text");
  };

  const edit = () => {
    if (!activeImage) return;
    setImageToImageDraft({
      prompt: activeImage.prompt,
      size: activeImage.size,
      refs: [{ preview: activeImage.imageUrl, base64: activeImage.imageUrl }],
    });
    setImageCreationMode("edit");
  };

  return (
    <aside className="asset-inspector">
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
          onClick={() => setInspectorCollapsed(true)}
          aria-label="收起素材检查器"
        >
          <AppIcon name="close" />
        </button>
      </header>

      {inspectorTab === "history" ? (
        <div className="asset-inspector__body">
          <label className="asset-search">
            <AppIcon name="search" size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索提示词" />
          </label>
          <div className="asset-filters">
            {(["all", "text", "edit"] as const).map((mode) => (
              <button
                key={mode}
                className={filter === mode ? "is-active" : ""}
                onClick={() => setFilter(mode)}
              >
                {mode === "all" ? "全部" : mode === "text" ? "文生图" : "图生图"}
              </button>
            ))}
          </div>
          {groups.length ? groups.map((group) => (
            <section className="asset-group" key={group.label}>
              <p>{group.label}</p>
              <div className="asset-grid">
                {group.images.map((image) => (
                  <div className="asset-thumbnail" key={image.id}>
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
                      onClick={() => {
                        const id = confirmedImageDeletionId(
                          image.id,
                          window.confirm("确认删除这张图片？"),
                        );
                        if (id) onDelete(id);
                      }}
                    >
                      <AppIcon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )) : <p className="asset-empty">没有匹配的图片</p>}
        </div>
      ) : (
        <div className="asset-inspector__body">
          {activeImage ? (
            <div className="asset-details">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeImage.thumbUrl || activeImage.imageUrl} alt={activeImage.prompt} />
              <p className="asset-details__prompt">{activeImage.prompt}</p>
              <dl>
                <div><dt>模型</dt><dd>{activeImage.model}</dd></div>
                <div><dt>尺寸</dt><dd>{activeImage.size}</dd></div>
                <div><dt>时间</dt><dd>{new Date(activeImage.createdAt).toLocaleString("zh-CN")}</dd></div>
              </dl>
              <div className="asset-details__actions">
                <button className="ui-button" onClick={reuse}><AppIcon name="copy" />复用参数</button>
                <button className="ui-button" onClick={edit}><AppIcon name="edit" />进入图生图</button>
                <button className="ui-button" onClick={() => downloadImage(activeImage)}><AppIcon name="download" />下载</button>
                <ImageActionMenu onDelete={() => {
                  if (window.confirm("确认删除这张图片？")) onDelete(activeImage.id);
                }} />
              </div>
            </div>
          ) : <p className="asset-empty">选择一张图片查看详情</p>}
        </div>
      )}
    </aside>
  );
}
