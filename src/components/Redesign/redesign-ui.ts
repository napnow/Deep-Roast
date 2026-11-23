import type { ImageRecord } from "@/types";
import { IMAGE_STYLE_PRESETS } from "@/types";
import { greatestCommonDivisor } from "@/lib/custom-image-ratio";

export type RedesignView = "create" | "gallery";

export interface ImageBatch {
  key: string;
  prompt: string;
  model: string;
  size: string;
  mode: "text" | "edit" | "unknown";
  createdAt: string;
  images: ImageRecord[];
}

/** 同一提示词、模型、尺寸、模式，且相邻两张间隔不超过该时长，视为同一批。 */
export const BATCH_WINDOW_MS = 3 * 60 * 1000;

function timeOf(value: string): number {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function groupImageBatches(
  history: readonly ImageRecord[],
  windowMs = BATCH_WINDOW_MS,
): ImageBatch[] {
  const sorted = [...history].sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
  const batches: ImageBatch[] = [];
  for (const image of sorted) {
    const mode = image.sourceMode ?? "unknown";
    const last = batches[batches.length - 1];
    const tail = last?.images[last.images.length - 1];
    if (
      last &&
      tail &&
      last.prompt === image.prompt &&
      last.model === image.model &&
      last.size === image.size &&
      last.mode === mode &&
      timeOf(tail.createdAt) - timeOf(image.createdAt) <= windowMs
    ) {
      last.images.push(image);
      continue;
    }
    batches.push({
      key: image.id,
      prompt: image.prompt,
      model: image.model,
      size: image.size,
      mode,
      createdAt: image.createdAt,
      images: [image],
    });
  }
  return batches;
}

export function dayLabel(dateStr: string, now: Date = new Date()): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "更早";
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff <= 0) return "今天";
  if (diff === 1) return "昨天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function clockLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function sizeAspect(size: string): { w: number; h: number; label: string } {
  const match = /^(\d+)\s*[x×]\s*(\d+)$/.exec((size || "").trim());
  if (!match) return { w: 1, h: 1, label: size || "1:1" };
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!w || !h) return { w: 1, h: 1, label: size };
  const g = greatestCommonDivisor(w, h);
  return { w, h, label: `${w / g}:${h / g}` };
}

/** 旧表单把风格拼成「风格\n\n提示词」，这里拆回来，用于展示和「复用参数」。 */
export function splitStylePrompt(prompt: string): { stylePrompt: string; styleLabel: string; prompt: string } {
  for (const preset of IMAGE_STYLE_PRESETS) {
    if (preset.prompt && prompt.startsWith(`${preset.prompt}\n\n`)) {
      return {
        stylePrompt: preset.prompt,
        styleLabel: preset.label,
        prompt: prompt.slice(preset.prompt.length + 2),
      };
    }
  }
  return { stylePrompt: "", styleLabel: "", prompt };
}
