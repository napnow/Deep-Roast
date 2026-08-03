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
  // gpt-image-2：请求接近的原生尺寸，后端 sharp 精确裁切到标准比例
  "gpt-image-2": [
    { value: "1024x1024", label: "1:1 (1024×1024)" },
    { value: "1080x1920", label: "9:16 (1080×1920)" },
    { value: "1920x1080", label: "16:9 (1920×1080)" },
    { value: "1080x1440", label: "3:4 (1080×1440)" },
    { value: "1440x1080", label: "4:3 (1440×1080)" },
  ],
};

export function getSizeOptions(model: string) {
  if (model.includes("seedream")) return MODEL_SIZE_OPTIONS.seedream;
  if (model === "gpt-image-2") return MODEL_SIZE_OPTIONS["gpt-image-2"];
  // OpenAI 兼容（grok-imagine 等）——与 gpt-image-2 同规格
  return MODEL_SIZE_OPTIONS["gpt-image-2"];
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

/**
 * 压缩图片为 data URL（canvas 缩放 + JPEG）：
 * 反推/图生图上传前压缩，避免大图撞 body 限制（base64 会膨胀 33%）。
 * - maxEdge: 最长边像素（默认 1024，够视觉模型识别）
 * - quality: JPEG 质量（默认 0.85）
 * 返回 Promise<dataUrl>；压缩失败时回落原图 data URL。
 */
export function compressImageFile(
  file: File,
  maxEdge = 1024,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.onload = () => {
      const original = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(original); // 解码失败则用原图
      img.onload = () => {
        try {
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(original);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const isPng = file.type === "image/png" && file.size < 600_000;
          const out = isPng
            ? canvas.toDataURL("image/png")
            : canvas.toDataURL("image/jpeg", quality);
          // 压缩后反而更大（如小图）则用原图
          resolve(out.length < original.length ? out : original);
        } catch {
          resolve(original);
        }
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
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
