import { ApiError } from "@/lib/client-api";
import type { ImageEditRequest } from "@/lib/image-edit-contract";

export type ImageTaskErrorKind = "credits" | "network" | "service";

export interface ImageTaskError {
  kind: ImageTaskErrorKind;
  message: string;
}

export interface ImageTaskRequest {
  mode: "text" | "edit";
  prompt: string;
  size: string;
  count: number;
  images?: string[];
  editRequest?: ImageEditRequest;
}

export interface ImageTaskState {
  status: "idle" | "generating" | "success" | "error";
  startedAt: number | null;
  request: ImageTaskRequest | null;
  resultIds: string[];
  error: ImageTaskError | null;
}

export const INITIAL_IMAGE_TASK: ImageTaskState = {
  status: "idle",
  startedAt: null,
  request: null,
  resultIds: [],
  error: null,
};

export function createImageTaskState(request: ImageTaskRequest): ImageTaskState {
  return {
    status: "generating",
    startedAt: Date.now(),
    request,
    resultIds: [],
    error: null,
  };
}

export function classifyImageTaskError(error: unknown): ImageTaskError {
  if (
    error instanceof ApiError &&
    (error.status === 402 || error.code === "INSUFFICIENT_CREDITS")
  ) {
    return { kind: "credits", message: error.message };
  }

  if (error instanceof ApiError) {
    return { kind: "service", message: error.message };
  }

  return {
    kind: "network",
    message: error instanceof Error ? error.message : "网络连接失败，请稍后重试",
  };
}
