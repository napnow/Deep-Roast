"use client";

import { useState, useEffect, useRef } from "react";
import type { ImageRecord } from "@/types";
import { getSizeOptions } from "./imageUtils";
import CreationPanel from "./CreationPanel";
import ResultCanvas from "./ResultCanvas";
import AssetInspector from "./AssetInspector";
import ImageMobileBar from "./ImageMobileBar";
import GalleryTab from "./GalleryTab";
import AnnouncementTab from "./AnnouncementTab";
import ImagePreviewModal from "./ImagePreviewModal";
import { useDeepRoastStore } from "@/lib/store";

type MobileTab = "generate" | "gallery" | "announcements";

interface ImageGenViewProps {
  model: string;
  onGenerate: (prompt: string, size: string, count?: number) => void;
  /** 图生图：原图直传编辑，支持多张参考图（最多 5 张） */
  onEditImage?: (images: string[], prompt: string, size: string) => void;
  /** 图生图批量：同参考图生成 N 张变体（最多 5） */
  onEditImageBatch?: (
    images: string[],
    prompt: string,
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

  useEffect(() => {
    const opts = getSizeOptions(model);
    if (!opts.find((o) => o.value === size)) {
      setSize(opts[0]?.value || "1024x1024");
    }
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="hidden md:flex flex-1 min-h-0 min-w-0">
        <CreationPanel
          model={model}
          generating={generating}
          credits={credits}
          isAdmin={Boolean(isAdmin)}
          onGenerate={handleGenerate}
          onEdit={(images, editPrompt, editSize, count) => {
            if (count > 1 && onEditImageBatch) {
              onEditImageBatch(images, editPrompt, editSize, count);
            } else {
              onEditImage?.(images, editPrompt, editSize);
            }
          }}
          onStop={onStopGenerate}
          onWalletClick={onWalletClick}
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
