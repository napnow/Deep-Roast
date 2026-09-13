"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
} from "react";
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
import Dialog from "@/components/ui/Dialog";
import { AppIcon } from "@/components/ui/icons";
import { useDeepRoastStore } from "@/lib/store";
import type { ImageEditRequest } from "@/lib/image-edit-contract";
import { createImageContinuationDraft } from "@/lib/image-continuation";
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
  /** 切回手机端生图页，以便打开图生图面板 */
  onMobileGenerateTab?: () => void;
  /** 手机端键盘占用的可视高度 */
  keyboardInset: number;
  /** 手机端键盘是否已打开 */
  keyboardOpen: boolean;
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
  onMobileGenerateTab,
  keyboardInset,
  keyboardOpen,
}: ImageGenViewProps) {
  const imageTask = useDeepRoastStore((state) => state.imageTask);
  const imageGenerationEnabled = useDeepRoastStore(
    (state) => state.config.imageGenerationEnabled,
  );
  const imageModels = useDeepRoastStore((state) => state.imageModels);
  const selectedImageModel = useDeepRoastStore(
    (state) => state.selectedImageModel,
  );
  const setSelectedImageModel = useDeepRoastStore(
    (state) => state.setSelectedImageModel,
  );
  const clearImageTask = useDeepRoastStore((state) => state.clearImageTask);
  const setImageToImageDraft = useDeepRoastStore(
    (state) => state.setImageToImageDraft,
  );
  const setImageCreationMode = useDeepRoastStore(
    (state) => state.setImageCreationMode,
  );
  const sizeOptions = getSizeOptions(model);
  const imageModelIds = imageModels.map((item) => item.id);
  const activeImageModel = imageModelIds.includes(selectedImageModel)
    ? selectedImageModel
    : model;
  const textDraft = useDeepRoastStore((state) => state.textToImageDraft);
  const setTextDraft = useDeepRoastStore((state) => state.setTextToImageDraft);
  const inspectorCollapsed = useDeepRoastStore(
    (state) => state.inspectorCollapsed,
  );
  const prompt = textDraft.prompt;
  const size = sizeOptions.some((option) => option.value === textDraft.size)
    ? textDraft.size
    : sizeOptions[0]?.value || "1024x1024";
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastGenTime, setLastGenTime] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null);
  const [openImageToImage, setOpenImageToImage] = useState(false);
  // 固定输入条的高度（结果区预留，避免被遮挡）
  const [barHeight, setBarHeight] = useState(120);
  const desktopWorkspaceRef = useRef<HTMLDivElement>(null);
  const preferredPanelWidth = useRef<number>(
    CREATION_PANEL_LAYOUT.defaultWidth,
  );
  const [creationPanelBounds, setCreationPanelBounds] =
    useState<CreationPanelBounds>(() => getCreationPanelBounds(1440));
  const [creationPanelWidth, setCreationPanelWidth] = useState<number>(
    CREATION_PANEL_LAYOUT.defaultWidth,
  );

  useEffect(() => {
    try {
      preferredPanelWidth.current = parseCreationPanelWidth(
        window.localStorage.getItem(CREATION_PANEL_LAYOUT.storageKey),
        {
          min: CREATION_PANEL_LAYOUT.minWidth,
          max: CREATION_PANEL_LAYOUT.maxWidth,
        },
      );
    } catch {
      /* Storage may be disabled; keep the session preference. */
    }
    function updatePanelBounds() {
      const bounds = getCreationPanelBounds(
        window.innerWidth,
        inspectorCollapsed ? 60 : 312,
      );
      setCreationPanelBounds(bounds);
      setCreationPanelWidth(
        clampCreationPanelWidth(preferredPanelWidth.current, bounds),
      );
      if (window.innerWidth >= 1200 || window.innerWidth < 768)
        setLibraryOpen(false);
    }
    updatePanelBounds();
    window.addEventListener("resize", updatePanelBounds);
    return () => window.removeEventListener("resize", updatePanelBounds);
  }, [inspectorCollapsed]);

  const handleCreationPanelWidthChange = useCallback(
    (nextWidth: number) => {
      const width = clampCreationPanelWidth(nextWidth, creationPanelBounds);
      preferredPanelWidth.current = width;
      setCreationPanelWidth(width);
      try {
        window.localStorage.setItem(
          CREATION_PANEL_LAYOUT.storageKey,
          String(width),
        );
      } catch {
        /* Resizing still works without storage. */
      }
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

  function handleContinueEditing(image: ImageRecord) {
    if (!image.imageUrl) return;
    setImageToImageDraft(createImageContinuationDraft(image));
    setImageCreationMode("edit");
    onActiveImageChange(image);
    setPreviewImage(null);
    onMobileGenerateTab?.();
    setOpenImageToImage(true);
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

        <div className="image-result-workspace">
          <div className="workspace-library-bar">
            <span>当前画布</span>
            <button
              type="button"
              className="workspace-library-trigger"
              onClick={() => setLibraryOpen(true)}
            >
              <AppIcon name="history" size={15} />
              作品库 <span>{history.length}</span>
            </button>
          </div>
          <ResultCanvas
            task={imageTask}
            activeImage={activeImage}
            results={taskResults}
            elapsedSeconds={elapsedSeconds}
            lastGenTime={lastGenTime}
            onPreview={setPreviewImage}
            onContinueEditing={handleContinueEditing}
            onRetry={onRetryGenerate}
            onStop={onStopGenerate}
            onClose={() => {
              onActiveImageChange(null);
              clearImageTask();
            }}
          />
        </div>
        <AssetInspector
          history={history}
          activeImage={activeImage}
          onSelect={handleSelectHistory}
          onContinueEditing={handleContinueEditing}
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
                onContinueEditing={handleContinueEditing}
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
          setPrompt={(value) => setTextDraft({ prompt: value })}
          size={size}
          setSize={(value) => setTextDraft({ size: value })}
          count={textDraft.count}
          setCount={(count) => setTextDraft({ count })}
          stylePrompt={textDraft.stylePrompt}
          sizeOptions={sizeOptions}
          imageModels={imageModelIds}
          selectedImageModel={activeImageModel}
          onModelChange={setSelectedImageModel}
          generating={generating}
          credits={credits}
          isAdmin={isAdmin}
          imageGenerationEnabled={
            imageGenerationEnabled !== false && Boolean(model)
          }
          onGenerate={handleGenerate}
          onEditImage={onEditImage}
          onEditImageBatch={onEditImageBatch}
          onStopGenerate={onStopGenerate}
          onHeightChange={setBarHeight}
          keyboardInset={keyboardInset}
          keyboardOpen={keyboardOpen}
          openImageToImage={openImageToImage}
          onImageToImageOpened={() => setOpenImageToImage(false)}
        />
      )}

      <Dialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        label="作品库"
      >
        <div
          className="workspace-library-backdrop"
          onClick={() => setLibraryOpen(false)}
          aria-hidden="true"
        />
        <div className="workspace-library-drawer">
          <AssetInspector
            forceExpanded
            onClose={() => setLibraryOpen(false)}
            history={history}
            activeImage={activeImage}
            onSelect={(image) => {
              handleSelectHistory(image);
              setLibraryOpen(false);
            }}
            onContinueEditing={(image) => {
              handleContinueEditing(image);
              setLibraryOpen(false);
            }}
            onDelete={onDeleteImage}
          />
        </div>
      </Dialog>

      {/* 大图预览（手机图库） */}
      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
        onContinueEditing={handleContinueEditing}
        onDelete={onDeleteImage}
      />
    </div>
  );
}
