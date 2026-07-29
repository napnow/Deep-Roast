"use client";

import { useState, useEffect, useRef } from "react";
import type { ImageRecord } from "@/types";
import { getSizeOptions } from "./imageUtils";
import ImageInputColumn from "./ImageInputColumn";
import ImageResultPanel from "./ImageResultPanel";
import ImageHistoryPanel from "./ImageHistoryPanel";

interface ImageGenViewProps {
  model: string;
  onGenerate: (prompt: string, size: string) => void;
  onStopGenerate: () => void;
  generating: boolean;
  history: ImageRecord[];
  onDeleteImage: (id: string) => void;
  credits: number;
  isAdmin?: boolean;
  checkinEligible?: boolean;
  todayChecked?: boolean;
  onCheckinClick?: () => void;
  onWalletClick?: () => void;
}

export default function ImageGenView({
  model,
  onGenerate,
  onStopGenerate,
  generating,
  history,
  onDeleteImage,
  credits,
  isAdmin,
  checkinEligible,
  todayChecked,
  onCheckinClick,
  onWalletClick,
}: ImageGenViewProps) {
  const sizeOptions = getSizeOptions(model);
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(sizeOptions[0]?.value || "1024x1024");
  const [activeImage, setActiveImage] = useState<ImageRecord | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastGenTime, setLastGenTime] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setActiveImage(history[0]);
    }
    prevGenerating.current = generating;
  }, [generating, history]);

  function handleGenerate(p: string, s: string) {
    setActiveImage(null);
    onGenerate(p, s);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <div className="flex-1 flex min-h-0 min-w-0">
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
          onSelect={(item) => {
            setActiveImage(item);
            setLastGenTime(null);
          }}
          onDelete={onDeleteImage}
        />
      </div>
    </div>
  );
}
