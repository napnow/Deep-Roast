import type { ImageEditTask } from "@/lib/image-edit-contract";
import { ApiError } from "@/server/http";
import {
  normalizeImageEditCount,
  isImageRefundPending,
  isImageQueueFull,
  publicImageEditError,
} from "./image-edit-tasks";

export type ImageEditTaskExecutor<T> = (
  task: ImageEditTask,
  taskIndex: number,
  variantIndex: number,
) => Promise<T>;

export interface ExecutedImageEditResult<T> {
  result: T;
  taskIndex: number;
  targetIndex: number;
}

export interface ImageEditTaskRun<T> {
  images: Array<ExecutedImageEditResult<T>>;
  total: number;
  succeeded: number;
  failed: number;
  lastError: string | null;
  refundPending?: true;
  queueFull?: true;
  contentPolicyRejected?: true;
}

export function largeOrUnknownReferences(inputs: string[]): boolean {
  return inputs.reduce((size, input) => size + input.length, 0) > 4 * 1024 * 1024 ||
    inputs.some((input) => { const value = input.trim(); return value.startsWith("/") || /^https?:\/\//i.test(value); });
}

export async function executeImageEditTasks<T>(
  tasks: ImageEditTask[],
  count: number | undefined,
  execute: ImageEditTaskExecutor<T>,
  signal?: AbortSignal,
): Promise<ImageEditTaskRun<T>> {
  const normalizedCount = normalizeImageEditCount(count);
  const images: Array<ExecutedImageEditResult<T>> = [];
  let failed = 0;
  let lastError: string | null = null;
  let pendingRefundMessage: string | null = null;
  let policyMessage: string | null = null;
  let busyCount = 0;

  const jobs = tasks.flatMap((task, taskIndex) =>
    Array.from({ length: normalizedCount }, (_, variantIndex) => ({ task, taskIndex, variantIndex })));
  const inputs = tasks.flatMap((task) => task.mode === "reference" ? [task.targetImage, ...task.referenceImages] : [task.targetImage]);
  // Large inline payloads and remote references can expand substantially in memory.
  // Unknown-size references also run sequentially on this small host.
  const parallelism = largeOrUnknownReferences(inputs) ? 1 : 2;
  const outcomes: Array<{ result?: T; error?: unknown; ok: boolean }> = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length && !signal?.aborted) {
      const index = next++;
      const job = jobs[index]!;
      try { outcomes[index] = { ok: true, result: await execute(job.task, job.taskIndex, job.variantIndex) }; }
      catch (error) { outcomes[index] = { ok: false, error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(parallelism, jobs.length) }, () => worker()));
  for (let index = 0; index < jobs.length; index++) {
    const job = jobs[index]!;
    const outcome = outcomes[index] ?? { ok: false, error: new Error("图片生成已取消") };
    if (outcome.ok) images.push({ result: outcome.result as T, taskIndex: job.taskIndex, targetIndex: job.task.targetIndex });
    else {
      failed += 1;
      if (isImageQueueFull(outcome.error)) busyCount++;
      if (isImageRefundPending(outcome.error)) pendingRefundMessage = publicImageEditError(outcome.error);
      if (outcome.error instanceof ApiError && outcome.error.code === "IMAGE_CONTENT_POLICY") policyMessage ??= outcome.error.message;
      lastError = pendingRefundMessage ?? policyMessage ?? publicImageEditError(outcome.error);
    }
  }

  return {
    images,
    total: tasks.length * normalizedCount,
    succeeded: images.length,
    failed,
    lastError,
    ...(pendingRefundMessage ? { refundPending: true as const } : {}),
    ...(busyCount > 0 && busyCount === jobs.length ? { queueFull: true as const } : {}),
    ...(policyMessage ? { contentPolicyRejected: true as const } : {}),
  };
}
