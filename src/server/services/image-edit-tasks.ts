import { ApiError } from "@/server/http";
import type {
  ImageEditItemInput,
  ImageEditRequest,
  ImageEditTask,
} from "@/lib/image-edit-contract";

export const MAX_IMAGE_EDIT_INPUTS = 5;
export const DEFAULT_IMAGE_EDIT_PROMPT = "生成这张图的变体";
export const PUBLIC_IMAGE_EDIT_ERROR = "图生图失败，请稍后重试";

export function publicImageEditError(error: unknown): string {
  return error instanceof ApiError && error.status < 500
    ? error.message
    : PUBLIC_IMAGE_EDIT_ERROR;
}

export function supportsReferenceImageEdit(model: string): boolean {
  return model.trim() === "gpt-image-2";
}

function cleanImage(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanImages(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map(cleanImage).filter(Boolean);
  }
  const image = cleanImage(value);
  return image ? [image] : [];
}

function cleanPrompt(value: unknown): string {
  const prompt = typeof value === "string" ? value.trim() : "";
  return prompt || DEFAULT_IMAGE_EDIT_PROMPT;
}

function normalizeItems(items: ImageEditItemInput[]): ImageEditTask[] {
  return items
    .map((item, index) => ({
      image: cleanImage(item?.image),
      prompt: cleanPrompt(item?.prompt),
      targetIndex:
        Number.isInteger(item?.targetIndex) && (item.targetIndex as number) >= 0
          ? (item.targetIndex as number)
          : index,
    }))
    .filter((item) => item.image)
    .map((item) => ({
      mode: "per-image" as const,
      targetImage: item.image,
      prompt: item.prompt,
      targetIndex: item.targetIndex,
    }));
}

function assertTaskCount(tasks: ImageEditTask[]) {
  if (tasks.length === 0) {
    throw new ApiError("至少需要一张图片", 400);
  }
  const inputCount = tasks.reduce(
    (total, task) =>
      total + (task.mode === "reference" ? task.referenceImages.length + 1 : 1),
    0,
  );
  if (inputCount > MAX_IMAGE_EDIT_INPUTS) {
    throw new ApiError("图片最多 " + MAX_IMAGE_EDIT_INPUTS + " 张", 400);
  }
}

export function normalizeImageEditRequest(
  input: ImageEditRequest,
  model: string,
): ImageEditTask[] {
  if (!input || typeof input !== "object") {
    throw new ApiError("图生图参数无效", 400);
  }

  let tasks: ImageEditTask[];

  if (input.mode === "reference") {
    const targetImage = cleanImage(input.targetImage);
    const referenceImages = cleanImages(input.referenceImages);
    if (!targetImage) {
      throw new ApiError("请选择目标图", 400);
    }
    if (referenceImages.length === 0) {
      throw new ApiError("请至少选择一张参考图", 400);
    }
    if (referenceImages.includes(targetImage)) {
      throw new ApiError("目标图不能作为参考图", 400);
    }
    if (!supportsReferenceImageEdit(model)) {
      throw new ApiError("参考图模式目前仅支持 GPT Image 2，请切换模型", 400);
    }
    tasks = [
      {
        mode: "reference",
        targetImage,
        referenceImages,
        prompt: cleanPrompt(input.prompt),
        targetIndex:
          Number.isInteger(input.targetIndex) && (input.targetIndex as number) >= 0
            ? (input.targetIndex as number)
            : 0,
      },
    ];
  } else if (input.mode === "per-image" && input.items) {
    tasks = normalizeItems(input.items);
  } else if (input.items) {
    tasks = normalizeItems(input.items);
  } else {
    const images = cleanImages(input.image);
    tasks = images.map((image, index) => ({
      mode: "per-image",
      targetImage: image,
      prompt: cleanPrompt(input.prompt),
      targetIndex: index,
    }));
  }

  assertTaskCount(tasks);
  return tasks;
}

export function normalizeImageEditCount(count: number | undefined): number {
  const safeCount =
    typeof count === "number" && Number.isFinite(count) ? count : 1;
  return Math.min(Math.max(Math.floor(safeCount), 1), 5);
}

export function calculateImageEditCost(
  tasks: ImageEditTask[],
  count: number,
): number {
  return tasks.length * normalizeImageEditCount(count);
}
