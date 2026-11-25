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

/**
 * grok-imagine（经 grok2api 代理）：接口只认 1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 3:2 / 2:3
 * 七种比例，输出像素由上游决定。这里用实测输出尺寸作为展示值与存档值。
 */
export const GROK_IMAGE_SIZE_OPTIONS: ImageSizeOption[] = [
  { value: "960x960", label: "1:1 (960×960)" },
  { value: "1280x720", label: "16:9 (1280×720)" },
  { value: "720x1280", label: "9:16 (720×1280)" },
  { value: "1088x816", label: "4:3 (1088×816)" },
  { value: "816x1088", label: "3:4 (816×1088)" },
  { value: "1152x768", label: "3:2 (1152×768)" },
  { value: "768x1152", label: "2:3 (768×1152)" },
];

/** grok2api /v1/images/generations 与 /v1/images/edits 接受的 aspect_ratio 取值。 */
export const GROK_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
] as const;

/**
 * Gemini 生图（经 Flow2API 代理）：上游只有比例式接口，分辨率由 imageSize 控制。
 * 两个本地模型 ID 共用同一个上游别名，仅 1K / 2K 不同。
 */
export const GEMINI_IMAGE_UPSTREAM_MODEL = "gemini-3.1-flash-image";
export const GEMINI_IMAGE_MODEL_1K = "gemini-3.1-flash-image-1k";
export const GEMINI_IMAGE_MODEL_2K = "gemini-3.1-flash-image-2k";

/** 1K 实测输出尺寸（上游按比例出图，不接受任意像素）。 */
export const GEMINI_IMAGE_1K_SIZE_OPTIONS: ImageSizeOption[] = [
  { value: "1024x1024", label: "1:1 (1024×1024)" },
  { value: "1376x768", label: "16:9 (1376×768)" },
  { value: "768x1376", label: "9:16 (768×1376)" },
  { value: "1200x896", label: "4:3 (1200×896)" },
  { value: "896x1200", label: "3:4 (896×1200)" },
];

/** 2K 实测输出尺寸。 */
export const GEMINI_IMAGE_2K_SIZE_OPTIONS: ImageSizeOption[] = [
  { value: "2048x2048", label: "1:1 (2048×2048)" },
  { value: "2752x1536", label: "16:9 (2752×1536)" },
  { value: "1536x2752", label: "9:16 (1536×2752)" },
  { value: "2400x1792", label: "4:3 (2400×1792)" },
  { value: "1792x2400", label: "3:4 (1792×2400)" },
];

/** Flow2API 接受的 aspectRatio 取值。 */
export const GEMINI_ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;

const GPT_IMAGE_MODEL_PATTERN = /^gpt-image-2(?:$|\.\d+(?:-|$))/i;

/** Whether a model supports the GPT image native-size plus exact-crop workflow. */
export function isGptImageModel(model: string): boolean {
  return GPT_IMAGE_MODEL_PATTERN.test(model.trim());
}

/** grok 渠道（grok-imagine 等）：参数走 grok2api 的比例式接口。 */
export function isGrokImageModel(model: string): boolean {
  return model.trim().toLowerCase().startsWith("grok-");
}

/** Gemini 生图模型（本地 1K / 2K 两条）。 */
export function isGeminiImageModel(model: string): boolean {
  const id = model.trim().toLowerCase();
  return id === GEMINI_IMAGE_MODEL_1K || id === GEMINI_IMAGE_MODEL_2K;
}

/** 本地模型 ID 对应的上游分辨率档位。 */
export function geminiImageSize(model: string): "1K" | "2K" {
  return model.trim().toLowerCase() === GEMINI_IMAGE_MODEL_2K ? "2K" : "1K";
}

/**
 * 把像素尺寸映射到支持的最近比例。
 * 用对数距离，保证 9:16 与 16:9 这类互为倒数的比例不会互相抢占。
 */
function nearestAspectRatio(
  size: string,
  ratios: readonly string[],
  fallback: string,
): string {
  const match = /^(\d+)x(\d+)$/.exec(size.trim());
  const width = match ? Number(match[1]) : 0;
  const height = match ? Number(match[2]) : 0;
  if (!width || !height) return fallback;
  const target = Math.log(width / height);
  let best = fallback;
  let bestDelta = Infinity;
  for (const ratio of ratios) {
    const [rw, rh] = ratio.split(":").map(Number) as [number, number];
    const delta = Math.abs(Math.log(rw / rh) - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = ratio;
    }
  }
  return best;
}

/**
 * 把像素尺寸映射到 grok2api 支持的最近比例。
 */
export function grokAspectRatio(size: string): string {
  return nearestAspectRatio(size, GROK_ASPECT_RATIOS, GROK_ASPECT_RATIOS[0]);
}

/** 把像素尺寸映射到 Gemini 支持的最近比例。 */
export function geminiAspectRatio(size: string): string {
  return nearestAspectRatio(size, GEMINI_ASPECT_RATIOS, GEMINI_ASPECT_RATIOS[0]);
}

/** Return the size selector options used by the image-generation workbench. */
export function getImageSizeOptions(model: string): ImageSizeOption[] {
  if (model.toLowerCase().includes("seedream")) {
    return SEEDREAM_IMAGE_SIZE_OPTIONS;
  }
  if (isGeminiImageModel(model)) {
    return geminiImageSize(model) === "2K"
      ? GEMINI_IMAGE_2K_SIZE_OPTIONS
      : GEMINI_IMAGE_1K_SIZE_OPTIONS;
  }
  if (isGrokImageModel(model)) {
    return GROK_IMAGE_SIZE_OPTIONS;
  }
  return GPT_IMAGE_SIZE_OPTIONS;
}
