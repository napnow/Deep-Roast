import { createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { ApiError } from "@/server/http";

const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpe?g|webp)$/i;
const LEGACY_IMAGE_KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/i;

export function privateImageRoot(): string {
  const configured = process.env.DEEPROAST_DATA_DIR?.trim();
  return path.resolve(configured || path.join(process.cwd(), "storage"), "images");
}

export function assertStorageKey(value: string): string {
  if (!STORAGE_KEY_PATTERN.test(value)) {
    throw new ApiError("图片地址无效", 404, "IMAGE_NOT_FOUND");
  }
  return value;
}

export function assertLegacyImageKey(value: string): string {
  if (!LEGACY_IMAGE_KEY_PATTERN.test(value)) {
    throw new ApiError("图片地址无效", 404, "IMAGE_NOT_FOUND");
  }
  return value;
}

export function privateImagePath(root: string, key: string): string {
  return path.join(root, assertStorageKey(key));
}

export function privateThumbnailPath(root: string, key: string): string {
  const safeKey = assertStorageKey(key);
  const thumbnailKey = safeKey.replace(/\.(png|jpe?g)$/i, ".webp");
  return path.join(root, "thumbs", thumbnailKey);
}

export function protectedImageUrl(key: string, thumbnail = false): string {
  const safeKey = assertStorageKey(key);
  return "/api/images/" + safeKey + (thumbnail ? "?thumb=1" : "");
}

export function protectedLegacyImageUrl(key: string, thumbnail = false): string {
  const safeKey = assertLegacyImageKey(key);
  return "/api/images/" + safeKey + (thumbnail ? "?thumb=1" : "");
}

function signingSecret(): string {
  const secret =
    process.env.IMAGE_URL_SIGNING_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "";
  if (!secret) {
    throw new ApiError("图片签名未配置", 503, "IMAGE_SIGNING_UNAVAILABLE");
  }
  return secret;
}

function signature(input: string): string {
  return createHmac("sha256", signingSecret())
    .update(input)
    .digest("base64url");
}

export function createImageAccessToken(
  key: string,
  userId: string,
  expiresAt = Math.floor(Date.now() / 1000) + 300,
): string {
  const safeKey = assertStorageKey(key);
  const payload = safeKey + "." + userId + "." + String(expiresAt);
  return String(expiresAt) + "." + signature(payload);
}

export function verifyImageAccessToken(
  token: string,
  key: string,
  userId: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  const [expiresRaw, provided] = token.split(".", 2);
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now || !provided) {
    return false;
  }
  const expected = signature(
    assertStorageKey(key) + "." + userId + "." + String(expiresAt),
  );
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
