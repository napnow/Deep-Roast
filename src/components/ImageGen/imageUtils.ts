import { BrowserActionError, initiateImageBlobDownload, initiateImageDownload } from "@/lib/browser-actions";
import { getSessionImage } from "@/lib/image-transfer";
import { getImageSizeOptions } from "@/lib/image-model-capabilities";
import type { ImageRecord } from "@/types";

/** 尺寸清单统一由 image-model-capabilities 维护，避免前后端两处定义漂移。 */
export function getSizeOptions(model: string) {
  return getImageSizeOptions(model);
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}

/** 取展示用缩略图 URL；无缩略图（历史旧图）回落原图 */
export function thumbSrc(record: {
  imageUrl: string;
  thumbUrl?: string;
}): string {
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

export function imageDownloadUrl(url: string): string | null {
  if (!/^\/api\/images\/[a-zA-Z0-9._-]+(?:\?|$)/.test(url)) return null;
  const parsed = new URL(url, "https://local.invalid");
  parsed.searchParams.delete("thumb");
  parsed.searchParams.set("download", "check");
  return parsed.pathname + parsed.search;
}

export async function downloadImage(image: ImageRecord, signal?: AbortSignal) {
  const attachmentUrl = imageDownloadUrl(image.imageUrl);
  if (attachmentUrl) {
    signal?.throwIfAborted();
    const check = await fetch(attachmentUrl, { signal });
    if (!check.ok) throw new BrowserActionError(check.status === 401 || check.status === 403 ? "下载未完成，请确认登录状态和图片权限。" : "图片暂时无法下载，请稍后重试。");
    signal?.throwIfAborted();
    const blob = await getSessionImage(image.imageUrl, signal);
    await initiateImageBlobDownload(blob, `DeepRoast-${image.id.slice(0, 8)}.png`, signal);
    return;
  }
  await initiateImageDownload(
    image.imageUrl,
    `DeepRoast-${image.id.slice(0, 8)}.png`,
    signal,
  );
}
