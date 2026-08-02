import type { ImageRecord } from "@/types";

export const MODEL_SIZE_OPTIONS: Record<
  string,
  { value: string; label: string }[]
> = {
  // 豆包 Seedream：官方支持 1:1 / 9:16 / 16:9（720×1280 / 1280×720）
  seedream: [
    { value: "1024x1024", label: "1:1 (1024×1024)" },
    { value: "720x1280", label: "9:16 (720×1280)" },
    { value: "1280x720", label: "16:9 (1280×720)" },
  ],
  // gpt-image-2：OpenAI 官方分辨率
  "gpt-image-2": [
    { value: "1024x1024", label: "1:1 (1024×1024)" },
    { value: "1024x1536", label: "9:16 (1024×1536)" },
    { value: "1536x1024", label: "16:9 (1536×1024)" },
    { value: "1024x1792", label: "3:4 (1024×1792)" },
    { value: "1792x1024", label: "4:3 (1792×1024)" },
  ],
};

export function getSizeOptions(model: string) {
  if (model.includes("seedream")) return MODEL_SIZE_OPTIONS.seedream;
  if (model === "gpt-image-2") return MODEL_SIZE_OPTIONS["gpt-image-2"];
  // OpenAI 兼容（grok-imagine 等）
  return [
    { value: "1024x1024", label: "1:1 (1024×1024)" },
    { value: "1024x1536", label: "9:16 (1024×1536)" },
    { value: "1536x1024", label: "16:9 (1536×1024)" },
    { value: "1024x1792", label: "3:4 (1024×1792)" },
    { value: "1792x1024", label: "4:3 (1792×1024)" },
  ];
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}

/** 取展示用缩略图 URL；无缩略图（历史旧图）回落原图 */
export function thumbSrc(record: { imageUrl: string; thumbUrl?: string }): string {
  return record.thumbUrl || record.imageUrl;
}

export async function downloadImage(image: ImageRecord) {
  try {
    const res = await fetch(image.imageUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DeepRoast-${image.id.slice(0, 8)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(image.imageUrl, "_blank");
  }
}
