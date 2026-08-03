"use client";

import { useState, useEffect, useRef } from "react";
import type { ImageRecord } from "@/types";
import { getSizeOptions } from "./imageUtils";
import ImageInputColumn from "./ImageInputColumn";
import ImageResultPanel from "./ImageResultPanel";
import ImageHistoryPanel from "./ImageHistoryPanel";
import ImageMobileBar from "./ImageMobileBar";
import GalleryTab from "./GalleryTab";
import AnnouncementTab from "./AnnouncementTab";
import ImagePreviewModal from "./ImagePreviewModal";
import MobileDrawer from "./MobileDrawer";

type MobileTab = "generate" | "gallery" | "announcements";

interface ImageGenViewProps {
  model: string;
  onGenerate: (prompt: string, size: string) => void;
  /** 图生图：原图直传编辑（返回编辑结果并入历史） */
  onEditImage?: (image: string, prompt: string, size: string) => void;
  onStopGenerate: () => void;
  generating: boolean;
  history: ImageRecord[];
  activeImage: ImageRecord | null;
  onActiveImageChange: (item: ImageRecord | null) => void;
  onDeleteImage: (id: string) => void;
  credits: number;
  isAdmin?: boolean;
  checkinEligible?: boolean;
  todayChecked?: boolean;
  onCheckinClick?: () => void;
  onWalletClick?: () => void;
  /** 手机端：当前 Tab（生成/图库/公告） */
  mobileTab: MobileTab;
  onMobileTabChange: (tab: MobileTab) => void;
  /** 手机端：抽屉侧栏开关 */
  drawerOpen: boolean;
  onDrawerClose: () => void;
}

export default function ImageGenView({
  model,
  onGenerate,
  onEditImage,
  onStopGenerate,
  generating,
  history,
  activeImage,
  onActiveImageChange,
  onDeleteImage,
  credits,
  isAdmin,
  checkinEligible,
  todayChecked,
  onCheckinClick,
  onWalletClick,
  mobileTab,
  onMobileTabChange,
  drawerOpen,
  onDrawerClose,
}: ImageGenViewProps) {
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

  function handleGenerate(p: string, s: string) {
    onActiveImageChange(null);
    onGenerate(p, s);
  }

  function handleSelectHistory(item: ImageRecord) {
    onActiveImageChange(item);
    setLastGenTime(null);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* 桌面端：三栏布局（md+） */}
      <div className="hidden md:flex flex-1 min-h-0 min-w-0">
        <ImageInputColumn
          prompt={prompt}
          setPrompt={setPrompt}
          size={size}
          setSize={setSize}
          sizeOptions={sizeOptions}
          generating={generating}
          credits={credits}
          isAdmin={isAdmin}
          checkinEligible={checkinEligible}
          todayChecked={todayChecked}
          onGenerate={handleGenerate}
          onEditImage={onEditImage}
          onStopGenerate={onStopGenerate}
          onCheckinClick={onCheckinClick}
          onWalletClick={onWalletClick}
        />

        <ImageResultPanel
          activeImage={activeImage}
          generating={generating}
          elapsedSeconds={elapsedSeconds}
          lastGenTime={lastGenTime}
        />

        <ImageHistoryPanel
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
              <ImageResultPanel
                activeImage={activeImage}
                generating={generating}
                elapsedSeconds={elapsedSeconds}
                lastGenTime={lastGenTime}
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
          onGenerate={handleGenerate}
          onEditImage={onEditImage}
          onStopGenerate={onStopGenerate}
          onHeightChange={setBarHeight}
        />
      )}

      {/* 手机端抽屉侧栏（汉堡唤起） */}
      <MobileDrawer
        open={drawerOpen}
        tab={mobileTab}
        historyCount={history.length}
        onSelect={(tab) => {
          onMobileTabChange(tab);
          onDrawerClose();
        }}
        onClose={onDrawerClose}
      />

      {/* 大图预览（手机图库） */}
      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
        onDelete={onDeleteImage}
      />
    </div>
  );
}
