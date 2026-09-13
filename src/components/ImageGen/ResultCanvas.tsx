"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { copyText } from "@/lib/browser-actions";
import { useActionFeedback } from "@/hooks/useActionFeedback";
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
  onContinueEditing: (item: ImageRecord) => void;
  onRetry: () => void;
  onStop: () => void;
  onClose: () => void;
  onWalletClick?: () => void;
}

export default function ResultCanvas({
  task,
  activeImage,
  results,
  elapsedSeconds,
  lastGenTime,
  onPreview,
  onContinueEditing,
  onRetry,
  onStop,
  onClose,
  onWalletClick,
}: ResultCanvasProps) {
  if (task.status === "generating") {
    return (
      <section className="result-canvas" aria-live="polite">
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
      </section>
    );
  }

  if (task.status === "error") {
    const kind = task.error?.kind;
    const title =
      kind === "credits"
        ? "积分不足"
        : kind === "network"
          ? "网络连接中断"
          : "服务暂时没有完成生成";
    return (
      <section className="result-canvas" aria-live="assertive">
        <section className="result-state-card is-error">
          <span className="result-error-mark">!</span>
          <div>
            <p className="result-state-title">{title}</p>
            <p className="result-state-copy">{task.error?.message}</p>
          </div>
          <p className="result-state-copy">
            {kind === "credits"
              ? "查看余额后调整生成数量，描述和参数已保留。"
              : kind === "network"
                ? "请先检查网络，描述和参数已保留，可返回修改或手动重试。"
                : "可以稍后重试或返回调整参数，不会自动再次提交。"}
          </p>
          <div className="result-error-actions">
            {kind === "credits" ? (
              onWalletClick && (
                <Button variant="primary" onClick={onWalletClick}>
                  查看积分
                </Button>
              )
            ) : (
              <Button variant="primary" onClick={onRetry}>
                <AppIcon name="refresh" size={15} />
                重新生成
              </Button>
            )}
            <Button onClick={onClose}>返回修改</Button>
          </div>
        </section>
      </section>
    );
  }

  const visibleResults =
    results.length > 0 ? results : activeImage ? [activeImage] : [];
  if (visibleResults.length === 0) {
    return (
      <section className="result-canvas">
        <section className="result-state-card is-idle">
          <div>
            <p className="result-state-title">创作舞台已就绪</p>
            <p className="result-state-copy">
              描述你想要的画面，生成结果会集中出现在这里
            </p>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="result-canvas">
      <div
        className={`result-grid ${visibleResults.length === 1 ? "is-single" : ""}`}
      >
        {visibleResults.map((image) => (
          <ResultCard
            key={image.id}
            image={image}
            lastGenTime={lastGenTime}
            onPreview={onPreview}
            onContinueEditing={onContinueEditing}
            onClose={onClose}
          />
        ))}
      </div>
    </section>
  );
}

function ResultCard({
  image,
  lastGenTime,
  onPreview,
  onContinueEditing,
  onClose,
}: {
  image: ImageRecord;
  lastGenTime: number | null;
  onPreview: (item: ImageRecord) => void;
  onContinueEditing: (item: ImageRecord) => void;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const copy = useActionFeedback(`${image.id}:copy`);
  const download = useActionFeedback(`${image.id}:download`);
  const copied = copy.status === "success";
  const downloaded = download.status === "success";
  const handleCopy = () => {
    void copy.run(() => copyText(image.prompt), "提示词已复制");
  };
  const handleDownload = () => {
    void download.run(
      (signal) => downloadImage(image, signal),
      "已发起下载",
      "下载未完成，请检查网络后重试。",
    );
  };

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
          <button
            type="button"
            aria-expanded={expanded}
            className={`result-prompt ${expanded ? "is-expanded" : ""}`}
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "点击收起" : "点击展开全部提示词"}
          >
            {image.prompt}
          </button>
          <p className="result-meta">
            {image.size}
            {lastGenTime != null ? ` · ${formatTime(lastGenTime)}` : ""}
          </p>
        </div>
        <div className="result-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => onContinueEditing(image)}
            aria-label="继续修改"
            title="继续修改"
          >
            <AppIcon name="edit" />
          </button>
          <button
            type="button"
            className={`icon-button ${copied ? "is-success" : ""}`}
            onClick={handleCopy}
            disabled={copy.status === "pending"}
            aria-busy={copy.status === "pending"}
            aria-label={
              copied
                ? "已复制"
                : copy.status === "pending"
                  ? "正在复制"
                  : "复制提示词"
            }
          >
            <AppIcon name={copied ? "check" : "copy"} />
          </button>
          <button
            type="button"
            className={`icon-button is-accent ${downloaded ? "is-success" : ""}`}
            onClick={handleDownload}
            disabled={download.status === "pending"}
            aria-busy={download.status === "pending"}
            aria-label={
              downloaded
                ? "已发起下载"
                : download.status === "pending"
                  ? "准备下载中"
                  : "下载图片"
            }
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
