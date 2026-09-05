import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/server/http";

export const ANNOUNCEMENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PUBLIC_PREFIX = "/api/public/announcement-images";
const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export function getAnnouncementImageExtension(mime: string): string | null {
  return ALLOWED_EXTENSIONS[mime] ?? null;
}

export function announcementImageRoot(): string {
  const configured = process.env.DEEPROAST_DATA_DIR?.trim();
  return path.resolve(
    configured || path.join(process.cwd(), "storage"),
    "announcement-images",
  );
}

export function assertAnnouncementImageKey(value: string): string {
  if (!/^[0-9a-f-]{36}\.(?:png|jpe?g|webp)$/i.test(value)) {
    throw new ApiError("公告图片不存在", 404, "ANNOUNCEMENT_IMAGE_NOT_FOUND");
  }
  return value;
}

export function announcementImagePath(key: string): string {
  return path.join(announcementImageRoot(), assertAnnouncementImageKey(key));
}

export function hasValidAnnouncementImageSignature(
  data: Buffer,
  mime: string,
): boolean {
  if (mime === "image/png") {
    return data.subarray(0, 8).equals(
      Buffer.from("89504e470d0a1a0a", "hex"),
    );
  }
  if (mime === "image/jpeg") {
    return data.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
  }
  if (mime === "image/webp") {
    return (
      data.subarray(0, 4).equals(Buffer.from("52494646", "hex")) &&
      data.subarray(8, 12).equals(Buffer.from("57454250", "hex"))
    );
  }
  return false;
}

export async function saveAnnouncementImage(
  data: Buffer,
  mime: string,
): Promise<string> {
  const extension = getAnnouncementImageExtension(mime);
  if (!extension) {
    throw new ApiError("仅支持 PNG / JPEG / WebP 图片", 400);
  }
  if (data.byteLength > ANNOUNCEMENT_IMAGE_MAX_BYTES) {
    throw new ApiError("二维码图片不能超过 2MB", 400);
  }
  if (!hasValidAnnouncementImageSignature(data, mime)) {
    throw new ApiError("二维码图片内容无效", 400);
  }

  const uploadDir = announcementImageRoot();
  await mkdir(uploadDir, { recursive: true });
  const filename = `${randomUUID()}${extension}`;
  await writeFile(path.join(uploadDir, filename), data);
  return `${PUBLIC_PREFIX}/${filename}`;
}

export async function removeAnnouncementImage(imagePath: string | null | undefined) {
  if (!imagePath) return;
  const filename = path.basename(imagePath);
  if (!filename || filename.includes("..")) return;
  try {
    await unlink(announcementImagePath(filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
