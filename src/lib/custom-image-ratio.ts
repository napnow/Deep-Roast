import { isGptImageModel, type ImageSizeOption } from "./image-model-capabilities";

// Keep in sync with the server-side limits in src/server/services/image.ts.
const MAX_IMAGE_PIXELS_LIMIT = 4_194_304;

export function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

export function ratioToImageSize(width: string, height: string): string | null {
  if (!/^\d{1,3}$/.test(width) || !/^\d{1,3}$/.test(height)) return null;
  const w = Number(width);
  const h = Number(height);
  if (w < 1 || h < 1 || w > 100 || h > 100) return null;
  const divisor = greatestCommonDivisor(w, h);
  const rw = w / divisor;
  const rh = h / divisor;
  // Integer multiples preserve the requested ratio without rounding distortion.
  const scale = Math.floor(1536 / Math.max(rw, rh));
  if (Math.min(rw, rh) * scale < 256) return null;
  return `${rw * scale}x${rh * scale}`;
}

export function pixelSizeToImageSize(width: string, height: string): string | null {
  if (!/^\d{1,4}$/.test(width) || !/^\d{1,4}$/.test(height)) return null;
  const w = Number(width);
  const h = Number(height);
  if (w < 256 || h < 256 || w > 2048 || h > 2048) return null;
  return w * h <= MAX_IMAGE_PIXELS_LIMIT ? `${w}x${h}` : null;
}

export function normalizeImageSizeSelection(
  size: string,
  model: string,
  options: ImageSizeOption[],
): string {
  if (options.some((option) => option.value === size)) return size;
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (isGptImageModel(model) && match) {
    const w = Number(match[1]);
    const h = Number(match[2]);
    if (w > 0 && h > 0 && w <= 2048 && h <= 2048) return size;
  }
  return options[0]?.value || "1024x1024";
}

export function imageSizeLabel(size: string): string {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return size;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!w || !h) return size;
  const divisor = greatestCommonDivisor(w, h);
  return `${w / divisor}:${h / divisor} (${w}×${h})`;
}
