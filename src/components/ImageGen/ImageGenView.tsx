"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import type { ImageRecord } from "@/types";
import { getSizeOptions } from "./imageUtils";
import CreationPanel from "./CreationPanel";
import CreationPanelResizeHandle from "./CreationPanelResizeHandle";
import ResultCanvas from "./ResultCanvas";
import AssetInspector from "./AssetInspector";
import ImageMobileBar from "./ImageMobileBar";
import GalleryTab from "./GalleryTab";
import AnnouncementTab from "./AnnouncementTab";
import ImagePreviewModal from "./ImagePreviewModal";
import { useDeepRoastStore } from "@/lib/store";
import type { ImageEditRequest } from "@/lib/image-edit-contract";
import {
  clampCreationPanelWidth,
  CREATION_PANEL_LAYOUT,
  getCreationPanelBounds,
  parseCreationPanelWidth,
  type CreationPanelBounds,
} from "./creation-workbench-ui";

type MobileTab = "generate" | "gallery" | "announcements";

interface ImageGenViewProps {
  model: string;
  onGenerate: (prompt: string, size: string, count?: number) => void;
  /** 图生图：按结构化任务编辑 */
  onEditImage?: (request: ImageEditRequest, size: string) => void;
  /** 图生图批量：按结构化任务生成 N 张变体（最多 5） */
  onEditImageBatch?: (
    request: ImageEditRequest,
    size: string,
    count: number,
  ) => void;
  onStopGenerate: () => void;
  onRetryGenerate: () => void;
  generating: boolean;
  history: ImageRecord[];
  activeImage: ImageRecord | null;
  onActiveImageChange: (item: ImageRecord | null) => void;
  onDeleteImage: (id: string) => void;
  credits: number;
  isAdmin?: boolean;
  onWalletClick?: () => void;
  /** 手机端：当前 Tab（生成/图库/公告） */
  mobileTab: MobileTab;
}

export default function ImageGenView({
  model,
  onGenerate,
  onEditImage,
  onEditImageBatch,
  onStopGenerate,
  onRetryGenerate,
  generating,
  history,
  activeImage,
  onActiveImageChange,
  onDeleteImage,
  credits,
  isAdmin,
  onWalletClick,
  mobileTab,
}: ImageGenViewProps) {
  const imageTask = useDeepRoastStore((state) => state.imageTask);
  const imageGenerationEnabled = useDeepRoastStore(
    (state) => state.config.imageGenerationEnabled,
  );
  const clearImageTask = useDeepRoastStore((state) => state.clearImageTask);
  const sizeOptions = getSizeOptions(model);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(sizeOptions[0]?.value || "1024x1024");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastGenTime, setLastGenTime] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null);
  // 固定输入条的高度（结果区预留，避免被遮挡）
  const [barHeight, setBarHeight] = useState(120);
  const desktopWorkspaceRef = useRef<HTMLDivElement>(null);
  const panelStorageReadyRef = useRef(false);
  const [creationPanelBounds, setCreationPanelBounds] = useState<CreationPanelBounds>(
    () => getCreationPanelBounds(1440),
  );
  const [creationPanelWidth, setCreationPanelWidth] = useState<number>(
    CREATION_PANEL_LAYOUT.defaultWidth,
  );

  useEffect(() => {
    const opts = getSizeOptions(model);
    if (!opts.find((o) => o.value === size)) {
      setSize(opts[0]?.value || "1024x1024");
    }
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!panelStorageReadyRef.current) return;
    try {
      window.localStorage.setItem(
        CREATION_PANEL_LAYOUT.storageKey,
        String(creationPanelWidth),
      );
    } catch {
      // 浏览器禁用本地存储时仍保留当前会话内的宽度调整
    }
  }, [creationPanelWidth]);

  useEffect(() => {
    function updatePanelBounds() {
      const nextBounds = getCreationPanelBounds(window.innerWidth);
      setCreationPanelBounds(nextBounds);
      setCreationPanelWidth((current) =>
        clampCreationPanelWidth(current, nextBounds),
      );
    }

    updatePanelBounds();
    const restoreFrame = window.requestAnimationFrame(() => {
      try {
        const savedWidth = window.localStorage.getItem(
          CREATION_PANEL_LAYOUT.storageKey,
        );
        setCreationPanelWidth(
          parseCreationPanelWidth(
            savedWidth,
            getCreationPanelBounds(window.innerWidth),
          ),
        );
      } catch {
        // 本地存储不可用时回退到默认宽度
      }
      panelStorageReadyRef.current = true;
    });
    window.addEventListener("resize", updatePanelBounds);
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      window.removeEventListener("resize", updatePanelBounds);
    };
  }, []);

  const handleCreationPanelWidthChange = useCallback(
    (nextWidth: number) => {
      setCreationPanelWidth(clampCreationPanelWidth(nextWidth, creationPanelBounds));
    },
    [creationPanelBounds],
  );

  useEffect(() => {
    if (generating) {
      setElapsedSeconds(0);
      setLastGenTime(null);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedSeconds((s) => {
        if (s > 0) setLastGenTime(s);
        return s;
      });
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [generating]);

  // 生成完成后展示最新图
  const prevGenerating = useRef(generating);
  useEffect(() => {
    if (prevGenerating.current && !generating && history.length > 0) {
      onActiveImageChange(history[0]);
    }
    prevGenerating.current = generating;
  }, [generating, history, onActiveImageChange]);

  function handleGenerate(p: string, s: string, count = 1) {
    onActiveImageChange(null);
    onGenerate(p, s, count);
  }

  function handleSelectHistory(item: ImageRecord) {
    onActiveImageChange(item);
    setLastGenTime(null);
    clearImageTask();
  }

  const taskResults = imageTask.resultIds
    .map((id) => history.find((item) => item.id === id))
    .filter((item): item is ImageRecord => Boolean(item));

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* 桌面端：三栏布局（md+） */}
      <div
        ref={desktopWorkspaceRef}
        className="image-workspace-desktop hidden md:flex flex-1 min-h-0 min-w-0"
        style={
          {
            "--creation-panel-width": `${creationPanelWidth}px`,
          } as CSSProperties
        }
      >
        <CreationPanel
          model={model}
          generating={generating}
          credits={credits}
          isAdmin={Boolean(isAdmin)}
          onGenerate={handleGenerate}
          onEdit={(request, editSize, count) => {
            if (count > 1 && onEditImageBatch) {
              onEditImageBatch(request, editSize, count);
            } else {
              onEditImage?.(request, editSize);
            }
          }}
          onStop={onStopGenerate}
          onWalletClick={onWalletClick}
        />

        <CreationPanelResizeHandle
          width={creationPanelWidth}
          bounds={creationPanelBounds}
          containerRef={desktopWorkspaceRef}
          onWidthChange={handleCreationPanelWidthChange}
        />

        <ResultCanvas
          task={imageTask}
          activeImage={activeImage}
          results={taskResults}
          elapsedSeconds={elapsedSeconds}
          lastGenTime={lastGenTime}
          onPreview={setPreviewImage}
          onRetry={onRetryGenerate}
          onStop={onStopGenerate}
          onClose={() => {
            onActiveImageChange(null);
            clearImageTask();
          }}
        />

        <AssetInspector
          history={history}
          activeImage={activeImage}
          onSelect={handleSelectHistory}
          onDelete={onDeleteImage}
        />
      </div>

      {/* 手机端：内容区 + 固定输入条（Tab 切换在抽屉侧栏） */}
      <div className="md:hidden flex-1 flex min-h-0 min-w-0">
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {mobileTab === "generate" ? (
            <div
              className="flex-1 min-h-0 flex flex-col"
              style={{ paddingBottom: barHeight }}
            >
              <ResultCanvas
                task={imageTask}
                activeImage={activeImage}
                results={taskResults}
                elapsedSeconds={elapsedSeconds}
                lastGenTime={lastGenTime}
                onPreview={setPreviewImage}
                onRetry={onRetryGenerate}
                onStop={onStopGenerate}
                onClose={() => {
                  onActiveImageChange(null);
                  clearImageTask();
                }}
              />
            </div>
          ) : mobileTab === "gallery" ? (
            <GalleryTab
              history={history}
              onPreview={setPreviewImage}
              onDelete={onDeleteImage}
            />
          ) : (
            <AnnouncementTab />
          )}
        </div>
      </div>

      {/* 固定输入条（仅手机端「生成」页） */}
      {mobileTab === "generate" && (
        <ImageMobileBar
          prompt={prompt}
          setPrompt={setPrompt}
          size={size}
          setSize={setSize}
          sizeOptions={sizeOptions}
          generating={generating}
          credits={credits}
          isAdmin={isAdmin}
          imageGenerationEnabled={imageGenerationEnabled}
          onGenerate={handleGenerate}
          onEditImage={onEditImage}
          onEditImageBatch={onEditImageBatch}
          onStopGenerate={onStopGenerate}
          onHeightChange={setBarHeight}
        />
      )}

      {/* 大图预览（手机图库） */}
      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
        onDelete={onDeleteImage}
      />
    </div>
  );
}
