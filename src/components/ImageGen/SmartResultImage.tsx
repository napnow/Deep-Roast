"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageRecord } from "@/types";

/**
 * 结果区大图渐进加载：
 * 1. 立即显示 webp 缩略图（秒开，不模糊等待）
 * 2. 后台加载原图，完成后淡入替换（清晰）
 * 移动端优先体验，桌面端也适用。
 */
export default function SmartResultImage({
  record,
  className,
  style,
}: {
  record: ImageRecord;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [showFull, setShowFull] = useState(false);
  const fullRef = useRef<HTMLImageElement>(null);
  const thumb = record.thumbUrl || record.imageUrl;

  useEffect(() => {
    // 原图加载完成后再替换
    const img = fullRef.current;
    if (!img) return;
    if (img.complete) {
      setShowFull(true);
      return;
    }
    const onLoad = () => setShowFull(true);
    img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [record.imageUrl]);

  return (
    <div
      className={className}
      style={{ ...style, position: "relative", maxHeight: "60vh" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumb}
        alt={record.prompt}
        className="w-full max-h-[60vh] object-contain"
        style={{ transition: "opacity 0.3s ease", opacity: showFull ? 0 : 1 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={fullRef}
        src={record.imageUrl}
        alt=""
        aria-hidden
        className="absolute inset-0 w-full h-full max-h-[60vh] object-contain"
        style={{ transition: "opacity 0.35s ease", opacity: showFull ? 1 : 0 }}
      />
    </div>
  );
}
