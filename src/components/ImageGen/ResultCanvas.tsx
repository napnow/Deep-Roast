"use client";

import { useState, useCallback } from "react";
import { ThinkingOrb } from "thinking-orbs";
import type { ImageRecord } from "@/types";
import type { ImageTaskState } from "@/lib/image-task";
import { AppIcon } from "@/components/ui/icons";
import SmartResultImage from "./SmartResultImage";
import { downloadImage, formatTime } from "./imageUtils";

interface ResultCanvasProps {
  task: ImageTaskState;
  activeImage: ImageRecord | null;
  results: ImageRecord[];
  elapsedSeconds: number;
  lastGenTime: number | null;
  onPreview: (item: ImageRecord) => void;
  onRetry: () => void;
  onStop: () => void;
  onClose: () => void;
}

export default function ResultCanvas({
  task,
  activeImage,
  results,
  elapsedSeconds,
  lastGenTime,
  onPreview,
  onRetry,
  onStop,
  onClose,
}: ResultCanvasProps) {
  if (task.status === "generating") {
    return (
      <main className="result-canvas" aria-live="polite">
        <section className="result-state-card is-working">
          <ThinkingOrb state="working" size={64} />
          <div>
            <p className="result-state-title">正在焙制你的画面</p>
            <p className="result-state-copy">
              {task.request?.count || 1} 张 · {formatTime(elapsedSeconds)}
            </p>
          </div>
          <button className="workspace-button is-secondary" onClick={onStop}>
            停止生成
          </button>
        </section>
      </main>
    );
  }

  if (task.status === "error") {
    const title = task.error?.kind === "credits" ? "积分不足" : "生成没有完成";
    return (
      <main className="result-canvas" aria-live="assertive">
        <section className="result-state-card is-error">
          <span className="result-error-mark">!</span>
          <div>
            <p className="result-state-title">{title}</p>
            <p className="result-state-copy">{task.error?.message}</p>
          </div>
          <button className="workspace-button" onClick={onRetry}>
            <AppIcon name="refresh" size={15} />
            重新生成
          </button>
        </section>
      </main>
    );
  }

  const visibleResults = results.length > 0 ? results : activeImage ? [activeImage] : [];
  if (visibleResults.length === 0) {
    return (
      <main className="result-canvas">
        <section className="result-state-card is-idle">
          <div>
            <p className="result-state-title">创作舞台已就绪</p>
            <p className="result-state-copy">从左侧输入提示词，生成结果会集中出现在这里</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="result-canvas">
      <div className={`result-grid ${visibleResults.length === 1 ? "is-single" : ""}`}>
        {visibleResults.map((image) => (
          <ResultCard
            key={image.id}
            image={image}
            lastGenTime={lastGenTime}
            onPreview={onPreview}
            onClose={onClose}
          />
        ))}
      </div>
    </main>
  );
}

function ResultCard({
  image,
  lastGenTime,
  onPreview,
  onClose,
}: {
  image: ImageRecord;
  lastGenTime: number | null;
  onPreview: (item: ImageRecord) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(image.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [image.prompt]);

  const handleDownload = useCallback(() => {
    downloadImage(image);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 1500);
  }, [image]);

  return (
    <article className="result-card">
      <button
        type="button"
        className="result-image-button"
        onClick={() => onPreview(image)}
        aria-label="查看大图"
      >
        <SmartResultImage record={image} className="result-image" />
      </button>
      <footer className="result-card-footer">
        <div className="min-w-0 flex-1">
          <p
            className={`result-prompt ${expanded ? "is-expanded" : ""}`}
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "点击收起" : "点击展开全部提示词"}
          >
            {image.prompt}
          </p>
          <p className="result-meta">
            {image.size}
            {lastGenTime != null ? ` · ${formatTime(lastGenTime)}` : ""}
          </p>
        </div>
        <div className="result-actions">
          <button
            type="button"
            className={`icon-button ${copied ? "is-success" : ""}`}
            onClick={handleCopy}
            aria-label={copied ? "已复制" : "复制提示词"}
          >
            <AppIcon name={copied ? "check" : "copy"} />
          </button>
          <button
            type="button"
            className={`icon-button is-accent ${downloaded ? "is-success" : ""}`}
            onClick={handleDownload}
            aria-label={downloaded ? "已下载" : "下载图片"}
          >
            <AppIcon name={downloaded ? "check" : "download"} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="关闭"
          >
            <AppIcon name="close" />
          </button>
        </div>
      </footer>
    </article>
  );
}
