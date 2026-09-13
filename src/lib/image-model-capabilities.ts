export interface ImageSizeOption {
  value: string;
  label: string;
}

export const SEEDREAM_IMAGE_SIZE_OPTIONS: ImageSizeOption[] = [
  { value: "1024x1024", label: "1:1 (1024×1024)" },
  { value: "720x1280", label: "9:16 (720×1280)" },
  { value: "1280x720", label: "16:9 (1280×720)" },
];

export const GPT_IMAGE_SIZE_OPTIONS: ImageSizeOption[] = [
  { value: "1024x1024", label: "1:1 (1024×1024)" },
  { value: "1080x1920", label: "9:16 (1080×1920)" },
  { value: "1920x1080", label: "16:9 (1920×1080)" },
  { value: "1080x1440", label: "3:4 (1080×1440)" },
  { value: "1440x1080", label: "4:3 (1440×1080)" },
];

const GPT_IMAGE_MODEL_PATTERN = /^gpt-image-2(?:$|\.5(?:-|$))/i;

/** Whether a model supports the GPT image native-size plus exact-crop workflow. */
export function isGptImageModel(model: string): boolean {
  return GPT_IMAGE_MODEL_PATTERN.test(model.trim());
}

/** Return the size selector options used by the image-generation workbench. */
export function getImageSizeOptions(model: string): ImageSizeOption[] {
  if (model.toLowerCase().includes("seedream")) {
    return SEEDREAM_IMAGE_SIZE_OPTIONS;
  }
  return GPT_IMAGE_SIZE_OPTIONS;
}
