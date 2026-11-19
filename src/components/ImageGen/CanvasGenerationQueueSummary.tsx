"use client";

import { useState } from "react";
import { formatTime } from "./imageUtils";
import type { CanvasGenerationTask } from "./canvas-generation-queue";

type CanvasGenerationQueueSummaryProps = {
  tasks: CanvasGenerationTask[];
  getLabel?: (nodeId: string) => string;
  onCancel: (nodeId: string) => void;
  onRetry: (nodeId: string) => void;
};

export default function CanvasGenerationQueueSummary({ tasks, getLabel = () => "画布节点", onCancel, onRetry }: CanvasGenerationQueueSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const active = tasks.filter(task => task.status === "generating");
  const queued = tasks.filter(task => task.status === "queued");
  const errors = tasks.filter(task => task.status === "error");
  const visible = [...active, ...queued, ...errors];
  if (!visible.length) return null;

  return (
    <section className="canvas-generation-queue" role="status" aria-live="polite">
      <button type="button" className="canvas-generation-queue__toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        <span className="canvas-generation-queue__dot" aria-hidden="true" />
        <strong>{active.length ? `正在生成 ${active.length} 个` : "生成任务"}</strong>
        {queued.length > 0 && <span>· 排队 {queued.length} 个</span>}
        {errors.length > 0 && <span>· 失败 {errors.length} 个</span>}
        <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>
      {expanded && <div className="canvas-generation-queue__list" aria-label="生成任务列表">
        {visible.map((task, index) => (
          <div className="canvas-generation-queue__item" key={task.taskId}>
            <div>
              <strong>{getLabel(task.nodeId)}</strong>
              <span>{task.status === "generating" ? `${task.count} 张 · ${formatTime(task.elapsedSeconds)}` : task.status === "queued" ? `排队中 · 前面 ${Math.max(0, index - active.length)} 个` : task.error || "生成失败"}</span>
            </div>
            {task.status === "error" ? <button type="button" onClick={() => onRetry(task.nodeId)}>重试</button> : <button type="button" onClick={() => onCancel(task.nodeId)}>停止</button>}
          </div>
        ))}
      </div>}
    </section>
  );
}
