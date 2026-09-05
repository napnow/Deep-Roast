import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/server/http";
import { hasValidAnnouncementImageSignature } from "./announcement-image";

export type SiteAssetKind = "contact" | "donation";

export const SITE_ASSET_MAX_BYTES = 2 * 1024 * 1024;
const PUBLIC_PREFIX = "/api/public/site-assets";
const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export function assertSiteAssetKind(value: string): SiteAssetKind {
  if (value !== "contact" && value !== "donation") {
    throw new ApiError("图片不存在", 404, "SITE_ASSET_NOT_FOUND");
  }
  return value;
}

export function assertSiteAssetKey(value: string): string {
  if (!/^[0-9a-f-]{36}\.(?:png|jpe?g|webp)$/i.test(value)) {
    throw new ApiError("图片不存在", 404, "SITE_ASSET_NOT_FOUND");
  }
  return value;
}

export function siteAssetRoot(kind: SiteAssetKind): string {
  const configured = process.env.DEEPROAST_DATA_DIR?.trim();
  return path.resolve(
    configured || path.join(process.cwd(), "storage"),
    "site-assets",
    kind,
  );
}

export function siteAssetPath(kind: SiteAssetKind, key: string): string {
  return path.join(siteAssetRoot(kind), assertSiteAssetKey(key));
}

export function siteAssetPublicPath(kind: SiteAssetKind, key: string): string {
  return `${PUBLIC_PREFIX}/${kind}/${assertSiteAssetKey(key)}`;
}

export async function saveSiteAsset(
  kind: SiteAssetKind,
  data: Buffer,
  mime: string,
): Promise<string> {
  const extension = ALLOWED_EXTENSIONS[mime];
  if (!extension) throw new ApiError("仅支持 PNG / JPEG / WebP 图片", 400);
  if (data.byteLength > SITE_ASSET_MAX_BYTES) {
    throw new ApiError("图片不能超过 2MB", 400);
  }
  if (!hasValidAnnouncementImageSignature(data, mime)) {
    throw new ApiError("图片内容无效", 400);
  }

  const key = `${randomUUID()}${extension}`;
  await mkdir(siteAssetRoot(kind), { recursive: true });
  await writeFile(siteAssetPath(kind, key), data, { flag: "wx" });
  return siteAssetPublicPath(kind, key);
}

export async function removeSiteAsset(
  kind: SiteAssetKind,
  publicPath: string | null | undefined,
): Promise<void> {
  if (!publicPath?.startsWith(`${PUBLIC_PREFIX}/${kind}/`)) return;
  const key = path.basename(publicPath);
  try {
    await unlink(siteAssetPath(kind, key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
