"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageRecord } from "@/types";
import { getSessionImage } from "@/lib/image-transfer";
import { useDeepRoastStore } from "@/lib/store";

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
  loadFull = true,
}: {
  record: ImageRecord;
  className?: string;
  style?: React.CSSProperties;
  loadFull?: boolean;
}) {
  const [showFull, setShowFull] = useState(false);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const fullRef = useRef<HTMLImageElement>(null);
  const thumb = record.thumbUrl || record.imageUrl;
  const sessionVersion = useDeepRoastStore((state) => state.userSessionVersion);
  const hasThumb = thumb !== record.imageUrl;
  const showThumb = loadFull || hasThumb;
  const protectedImage = /^\/api\/images\/[a-zA-Z0-9._-]+(?:\?|$)/.test(record.imageUrl);

  // 切换图片时重置：先显示缩略图，原图加载完再淡入
  useEffect(() => {
    setShowFull(false);
    setFullUrl(null);
    if (!loadFull || !hasThumb) return;
    if (!protectedImage) { setFullUrl(record.imageUrl); return; }
    let active = true;
    let objectUrl: string | null = null;
    const controller = new AbortController();
    getSessionImage(record.imageUrl, controller.signal)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setFullUrl(objectUrl);
      })
      .catch(() => {
        // Keep the thumbnail visible if the original fails.
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [record.imageUrl, loadFull, protectedImage, hasThumb, sessionVersion]);

  useEffect(() => {
    // 原图加载完成后再替换
    const img = fullRef.current;
    if (!img || !loadFull) return;
    if (img.complete && img.naturalWidth > 0) {
      setShowFull(true);
      return;
    }
    const onLoad = () => setShowFull(true);
    img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [record.imageUrl, loadFull, fullUrl]);

  return (
    <div
      className={className}
      style={{ ...style, position: "relative", maxHeight: "60vh" }}
    >
      {showThumb ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={record.prompt}
            className="w-full max-h-[60vh] object-contain"
            style={{
              transition: "opacity 0.3s ease",
              opacity: showFull && loadFull ? 0 : 1,
            }}
          />
        </>
      ) : (
        <div className="result-image-placeholder">打开查看原图</div>
      )}
      {loadFull && fullUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={fullRef}
          src={fullUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full max-h-[60vh] object-contain"
          style={{
            transition: "opacity 0.35s ease",
            opacity: showFull ? 1 : 0,
          }}
        />
      )}
    </div>
  );
}
