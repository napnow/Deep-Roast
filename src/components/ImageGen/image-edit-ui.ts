import type { ImageEditRequest } from "@/lib/image-edit-contract";

export type ImageEditUiState =
  | {
      mode: "per-image";
      prompts: string[];
    }
  | {
      mode: "reference";
      targetIndex: number;
      referenceIndexes: number[];
    };

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(Math.floor(index) || 0, 0), length - 1);
}

export function buildImageEditRequest(
  images: string[],
  state: ImageEditUiState,
  sharedPrompt: string,
): ImageEditRequest {
  const prompt = sharedPrompt.trim();

  if (state.mode === "per-image") {
    return {
      mode: "per-image",
      items: images.map((image, index) => ({
        image,
        prompt: state.prompts[index]?.trim() || prompt,
        targetIndex: index,
      })),
    };
  }

  const targetIndex = clampIndex(state.targetIndex, images.length);
  const referenceImages = Array.from(new Set(state.referenceIndexes))
    .filter(
      (index) =>
        index >= 0 &&
        index < images.length &&
        index !== targetIndex,
    )
    .map((index) => images[index]!)
    .filter(Boolean);

  return {
    mode: "reference",
    targetImage: images[targetIndex] || "",
    targetIndex,
    referenceImages,
    prompt,
  };
}

export function imageEditTaskCount(request: ImageEditRequest): number {
  return request.mode === "reference" ? 1 : request.items?.length || 0;
}
