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

const GPT_IMAGE_MODEL_PATTERN = /^gpt-image-2(?:$|\.5(?:-|$))/i;

/** Whether a model supports the GPT image native-size plus exact-crop workflow. */
export function isGptImageModel(model: string): boolean {
  return GPT_IMAGE_MODEL_PATTERN.test(model.trim());
}

/** grok 渠道（grok-imagine 等）：参数走 grok2api 的比例式接口。 */
export function isGrokImageModel(model: string): boolean {
  return model.trim().toLowerCase().startsWith("grok-");
}

/**
 * 把像素尺寸映射到 grok2api 支持的最近比例。
 * 用对数距离，保证 9:16 与 16:9 这类互为倒数的比例不会互相抢占。
 */
export function grokAspectRatio(size: string): string {
  const match = /^(\d+)x(\d+)$/.exec(size.trim());
  const width = match ? Number(match[1]) : 0;
  const height = match ? Number(match[2]) : 0;
  if (!width || !height) return GROK_ASPECT_RATIOS[0];
  const target = Math.log(width / height);
  let best: string = GROK_ASPECT_RATIOS[0];
  let bestDelta = Infinity;
  for (const ratio of GROK_ASPECT_RATIOS) {
    const [rw, rh] = ratio.split(":").map(Number) as [number, number];
    const delta = Math.abs(Math.log(rw / rh) - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = ratio;
    }
  }
  return best;
}

/** Return the size selector options used by the image-generation workbench. */
export function getImageSizeOptions(model: string): ImageSizeOption[] {
  if (model.toLowerCase().includes("seedream")) {
    return SEEDREAM_IMAGE_SIZE_OPTIONS;
  }
  if (isGrokImageModel(model)) {
    return GROK_IMAGE_SIZE_OPTIONS;
  }
  return GPT_IMAGE_SIZE_OPTIONS;
}
