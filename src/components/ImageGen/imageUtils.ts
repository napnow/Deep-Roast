import type { ImageRecord } from "@/types";

export const MODEL_SIZE_OPTIONS: Record<
  string,
  { value: string; label: string }[]
> = {
  seedream: [{ value: "1024x1024", label: "1:1 (1024×1024)" }],
  "gpt-image-2": [
    { value: "1024x1024", label: "1:1 (1024×1024)" },
    { value: "1024x1792", label: "3:4 (1024×1792)" },
    { value: "1792x1024", label: "4:3 (1792×1024)" },
  ],
};

export function getSizeOptions(model: string) {
  if (model.includes("seedream")) return MODEL_SIZE_OPTIONS.seedream;
  if (model === "gpt-image-2") return MODEL_SIZE_OPTIONS["gpt-image-2"];
  return [
    { value: "1024x1024", label: "1:1 (1024×1024)" },
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

export async function downloadImage(image: ImageRecord) {
  try {
    const res = await fetch(image.imageUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doubao-${image.id.slice(0, 8)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(image.imageUrl, "_blank");
  }
}
