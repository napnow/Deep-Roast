import type { ImageRecord } from "@/types";
import type { ImageToImageDraft } from "./image-workspace";

/** Builds the existing img2img draft shape from an image already in the user's history. */
export function createImageContinuationDraft(image: ImageRecord): ImageToImageDraft {
  return {
    prompt: image.prompt,
    size: image.size,
    count: 1,
    styleId: "",
    styleColor: "",
    styleTexture: "",
    refs: [{ preview: image.imageUrl, base64: image.imageUrl }],
  };
}
