import type { ImageEditTask } from "@/lib/image-edit-contract";
import { ApiError } from "@/server/http";
import {
  normalizeImageEditCount,
  isImageRefundPending,
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
  contentPolicyRejected?: true;
}

export async function executeImageEditTasks<T>(
  tasks: ImageEditTask[],
  count: number | undefined,
  execute: ImageEditTaskExecutor<T>,
): Promise<ImageEditTaskRun<T>> {
  const normalizedCount = normalizeImageEditCount(count);
  const images: Array<ExecutedImageEditResult<T>> = [];
  let failed = 0;
  let lastError: string | null = null;
  let pendingRefundMessage: string | null = null;
  let policyMessage: string | null = null;

  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
    const task = tasks[taskIndex]!;
    for (let variantIndex = 0; variantIndex < normalizedCount; variantIndex += 1) {
      try {
        const result = await execute(task, taskIndex, variantIndex);
        images.push({ result, taskIndex, targetIndex: task.targetIndex });
      } catch (error) {
        failed += 1;
        if (isImageRefundPending(error)) pendingRefundMessage = publicImageEditError(error);
        if (error instanceof ApiError && error.code === "IMAGE_CONTENT_POLICY") {
          policyMessage ??= error.message;
        }
        lastError = pendingRefundMessage ?? policyMessage ?? publicImageEditError(error);
      }
    }
  }

  return {
    images,
    total: tasks.length * normalizedCount,
    succeeded: images.length,
    failed,
    lastError,
    ...(pendingRefundMessage ? { refundPending: true as const } : {}),
    ...(policyMessage ? { contentPolicyRejected: true as const } : {}),
  };
}
