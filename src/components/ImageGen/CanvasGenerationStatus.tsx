"use client";

import { ThinkingOrb } from "thinking-orbs";
import { formatTime } from "./imageUtils";
import ImageGenStageIndicator from "./ImageGenStageIndicator";
import type { CanvasGenerationTask } from "./canvas-generation-queue";

type CanvasGenerationStatusProps = {
  task: CanvasGenerationTask;
  queuePosition?: number;
  promptSummary?: string;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
};

export default function CanvasGenerationStatus({
  task,
  queuePosition,
  promptSummary,
  onCancel,
  onRetry,
  onDismiss,
}: CanvasGenerationStatusProps) {
  const title = promptSummary?.trim() || "画布节点";
  const isActive = task.status === "generating";
  const isQueued = task.status === "queued";
  const isError = task.status === "error";

  return (
    <section className={`canvas-generation-status is-${task.status}`} role="status" aria-live="polite" aria-label={`${title}生成状态`}>
      {isActive && <ThinkingOrb state="working" size={42} />}
      {isQueued && <span className="canvas-generation-status__queue-mark" aria-hidden="true">⋯</span>}
      {isError && <span className="canvas-generation-status__error-mark" aria-hidden="true">!</span>}
      <div className="canvas-generation-status__body">
        <strong>{isQueued ? "排队中" : isActive ? "正在生成" : isError ? "生成失败" : task.status === "cancelled" ? "已取消" : "已生成"}</strong>
        <span>{title}</span>
        {isActive && <span>{task.count} 张 · {formatTime(task.elapsedSeconds)}</span>}
        {isQueued && <span>{queuePosition ? `前面还有 ${queuePosition} 个任务` : "等待生成资源"}</span>}
        {task.status === "success" && <span>已完成 {task.completed} 张{task.failed ? `，${task.failed} 张失败` : ""}</span>}
        {isError && <span className="canvas-generation-status__error-copy">{task.error || "服务暂时没有完成生成"}</span>}
        {isActive && <ImageGenStageIndicator elapsedSeconds={task.elapsedSeconds} className="canvas-generation-status__stage" />}
      </div>
      <div className="canvas-generation-status__actions">
        {(isActive || isQueued) && <button type="button" onClick={onCancel}>停止生成</button>}
        {isError && <button type="button" onClick={onRetry}>重新生成</button>}
        {(isError || task.status === "success" || task.status === "cancelled") && <button type="button" className="is-muted" onClick={onDismiss}>关闭</button>}
      </div>
    </section>
  );
}
