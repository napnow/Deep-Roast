import { db } from "@/db";
import { imageGenerations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getConfig } from "@/lib/config";
import { mkdir, unlink, access, readFile, open, rename, chmod, type FileHandle } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { CREDIT_PER_IMAGE } from "@/types";
import { ApiError } from "@/server/http";
import {
  isConfiguredModelEnabled,
  resolveConfiguredEndpoint,
} from "@/server/services/model-channels";
import {
  assertEnoughCredits,
  reserveCredits,
  type CreditReservation,
} from "@/server/services/credits";
import {
  requestPublicHttpsBuffer,
  requestPublicHttpsResponse,
} from "@/server/safe-http";
import { assertImageGenerationAllowed } from "@/server/services/site-settings";
import type { ImageEditRequest } from "@/lib/image-edit-contract";
import {
  PUBLIC_IMAGE_EDIT_ERROR,
  calculateImageEditCost,
  normalizeImageEditCount,
  normalizeImageEditRequest,
} from "./image-edit-tasks";
import { executeImageEditTasks } from "./image-edit-runner";
import {
  privateImagePath,
  privateImageRoot,
  privateThumbnailPath,
  protectedLegacyImageUrl,
  protectedImageUrl,
} from "./private-images";
import { providerIdempotencyKey } from "./request-idempotency";

const MAX_PROMPT_LENGTH = 2000;

export const MAX_IMAGE_EDGE = 2048;
export const MAX_IMAGE_PIXELS = 4_194_304;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_REFERENCE_TOTAL_BYTES = 30 * 1024 * 1024;
export const IMAGE_UPSTREAM_TIMEOUT_MS = 300_000;
const MAX_UPSTREAM_JSON_BYTES = 40 * 1024 * 1024;

async function postJsonUpstream(
  url: string,
  headers: Record<string, string>,
  body: string,
  enforcePublicHttps: boolean | undefined,
  signal?: AbortSignal,
): Promise<Response> {
  if (enforcePublicHttps) {
    return requestPublicHttpsResponse(url, {
      method: "POST",
      headers,
      body,
      timeoutMs: IMAGE_UPSTREAM_TIMEOUT_MS,
      maxBytes: MAX_UPSTREAM_JSON_BYTES,
      signal,
    });
  }
  const timeoutSignal = AbortSignal.timeout(IMAGE_UPSTREAM_TIMEOUT_MS);
  return fetch(url, {
    method: "POST",
    redirect: "error",
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    headers,
    body,
  });
}

const SUPPORTED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * gpt-image-2 等 OpenAI 兼容模型的原生支持尺寸。
 * 标准比例（9:16 等）用最近原生尺寸生成，再由 sharp 精确裁切。
 */
const NATIVE_SIZES = [
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1024x1792",
  "1792x1024",
];

/** 需要走「原生尺寸 + 精确裁切」的模型（其他模型直接用请求 size） */
const CROP_MODELS = new Set(["gpt-image-2"]);
const STANDARD_IMAGE_SIZES = new Set(["1024x1024", "1024x1536", "1536x1024"]);

class RetryableImageUpstreamError extends Error {}

export function assertImageSize(size: string, model: string): string {
  const normalized = size.trim();
  const dimensions = /^(\d+)x(\d+)$/.exec(normalized);

  // CROP_MODELS（如 gpt-image-2）：前端传任意合法 WxH，后端 nearestNativeSize 映射 + sharp 裁切
  if (CROP_MODELS.has(model)) {
    if (!dimensions) {
      throw new ApiError("不支持的图片尺寸", 400);
    }
    const width = Number(dimensions[1]);
    const height = Number(dimensions[2]);
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > MAX_IMAGE_EDGE ||
      height > MAX_IMAGE_EDGE ||
      width * height > MAX_IMAGE_PIXELS
    ) {
      throw new ApiError("不支持的图片尺寸", 400);
    }
    return normalized;
  }
  if (!STANDARD_IMAGE_SIZES.has(normalized)) {
    throw new ApiError("不支持的图片尺寸", 400);
  }
  return normalized;
}

export function shouldRetryImageError(error: unknown): boolean {
  if (error instanceof ApiError) return false;
  if (error instanceof RetryableImageUpstreamError || error instanceof TypeError) {
    return true;
  }
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "TimeoutError"
  );
}

function parseSize(size: string): { w: number; h: number } | null {
  const m = /^(\d+)x(\d+)$/.exec(size.trim());
  if (!m) return null;
  return { w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
}

/** 取最接近目标比例的原生请求尺寸（优先同方向且面积接近） */
function nearestNativeSize(target: string): string {
  const t = parseSize(target);
  if (!t) return "1024x1024";
  const targetRatio = t.w / t.h;
  let best = NATIVE_SIZES[0]!;
  let bestScore = Infinity;
  for (const s of NATIVE_SIZES) {
    const ns = parseSize(s)!;
    const ratio = ns.w / ns.h;
    // 比例接近度优先，其次面积差异小
    const score =
      Math.abs(ratio - targetRatio) * 10 +
      Math.abs(Math.log(ns.w * ns.h) - Math.log(t.w * t.h));
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/** 把生成的 buffer 精确裁切到目标尺寸（fit cover 居中），返回新 buffer */
async function cropToSize(
  buffer: Buffer,
  target: string,
): Promise<{ buffer: Buffer; size: string }> {
  const t = parseSize(target);
  if (!t) return { buffer, size: target };
  try {
    const { default: sharp } = await import("sharp");
    const out = await sharp(buffer)
      .resize(t.w, t.h, { fit: "cover", position: "centre" })
      .toBuffer();
    return { buffer: out, size: target };
  } catch {
    throw new ApiError("图片裁切失败", 502, "IMAGE_PROCESSING_ERROR");
  }
}

export async function preserveOrCropImage(
  buffer: Buffer,
  target: string,
  needsCrop: boolean,
): Promise<Buffer> {
  if (!needsCrop) return buffer;
  return (await cropToSize(buffer, target)).buffer;
}

function mimeForFormat(format: string | undefined): string | null {
  if (format === "png") return "image/png";
  if (format === "jpeg" || format === "jpg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return null;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function assertImageByteLimit(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_IMAGE_BYTES) {
    throw new ApiError("图片文件过大", 400, "IMAGE_TOO_LARGE");
  }
}

function decodeBase64(value: string): Buffer {
  if (
    !value ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value) ||
    (value.includes("=") && !/={1,2}$/.test(value))
  ) {
    throw new ApiError("图片数据无效", 400, "INVALID_IMAGE");
  }

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const decodedLength = (value.length / 4) * 3 - padding;
  assertImageByteLimit(decodedLength);

  const buffer = Buffer.from(value, "base64");
  if (
    buffer.length !== decodedLength ||
    buffer.toString("base64") !== value
  ) {
    throw new ApiError("图片数据无效", 400, "INVALID_IMAGE");
  }
  return buffer;
}

async function inspectImage(
  buffer: Buffer,
  declaredMime?: string,
): Promise<string> {
  assertImageByteLimit(buffer.length);
  try {
    const { default: sharp } = await import("sharp");
    const metadata = await sharp(buffer).metadata();
    const mime = mimeForFormat(metadata.format);
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    if (
      !mime ||
      !SUPPORTED_IMAGE_MIME.has(mime) ||
      !width ||
      !height ||
      width > MAX_IMAGE_EDGE ||
      height > MAX_IMAGE_EDGE ||
      width * height > MAX_IMAGE_PIXELS ||
      (declaredMime && declaredMime !== mime)
    ) {
      throw new Error("unsupported image");
    }
    return mime;
  } catch {
    throw new ApiError("参考图必须是有效的 PNG、JPEG 或 WebP 图片", 400, "INVALID_IMAGE");
  }
}

async function readLocalReference(value: string, userId: string): Promise<Buffer> {
  const match = /^\/images\/([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(value);
  const protectedMatch = /^\/api\/images\/([A-Za-z0-9][A-Za-z0-9._-]+)$/.exec(value);
  if (!match && !protectedMatch) throw new ApiError("参考图地址无效", 400, "INVALID_IMAGE");

  const key = protectedMatch ? protectedMatch[1] : match ? match[1] : "";
  const [record] = await db
    .select({ storageKey: imageGenerations.storageKey, imageUrl: imageGenerations.imageUrl })
    .from(imageGenerations)
    .where(
      and(
        eq(imageGenerations.userId, userId),
        protectedMatch
          ? eq(imageGenerations.storageKey, key)
          : eq(imageGenerations.imageUrl, `/images/${key}`),
      ),
    )
    .limit(1);
  if (!record) throw new ApiError("参考图不存在", 400, "INVALID_IMAGE");

  const imagePath = record.storageKey
    ? privateImagePath(privateImageRoot(), record.storageKey)
    : path.join(process.cwd(), "public", "images", key);
  try {
    const buffer = await readFile(imagePath);
    assertImageByteLimit(buffer.length);
    return buffer;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("参考图不存在", 400, "INVALID_IMAGE");
  }
}

async function readReference(value: string, userId?: string): Promise<{
  buffer: Buffer;
  declaredMime?: string;
}> {
  const dataUrl = /^data:(image\/(?:png|jpeg|webp));base64,(.*)$/i.exec(value);
  if (dataUrl) {
    const declaredMime = dataUrl[1]!.toLowerCase();
    return { buffer: decodeBase64(dataUrl[2]!), declaredMime };
  }

  if (value.startsWith("/images/") || value.startsWith("/api/images/")) {
    if (!userId) throw new ApiError("参考图地址无效", 400, "INVALID_IMAGE");
    return { buffer: await readLocalReference(value, userId) };
  }

  const result = await requestPublicHttpsBuffer(value, {
    timeoutMs: IMAGE_UPSTREAM_TIMEOUT_MS,
    maxBytes: MAX_IMAGE_BYTES,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError("远程参考图下载失败", 400, "INVALID_IMAGE");
  }

  const contentType = headerValue(result.headers, "content-type")
    .split(";", 1)[0]!
    .trim()
    .toLowerCase();
  if (!SUPPORTED_IMAGE_MIME.has(contentType)) {
    throw new ApiError("远程参考图不是支持的图片格式", 400, "INVALID_IMAGE");
  }
  return { buffer: result.body, declaredMime: contentType };
}

export async function normalizeReferenceImages(
  values: string[],
  userId?: string,
): Promise<string[]> {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ApiError("至少需要一张参考图", 400, "INVALID_IMAGE");
  }
  if (values.length > 5) {
    throw new ApiError("参考图最多 5 张", 400, "INVALID_IMAGE");
  }

  const normalized: string[] = [];
  let totalBytes = 0;

  for (const rawValue of values) {
    if (typeof rawValue !== "string") {
      throw new ApiError("参考图参数无效", 400, "INVALID_IMAGE");
    }
    const value = rawValue.trim();
    if (!value) throw new ApiError("参考图参数无效", 400, "INVALID_IMAGE");

    const { buffer, declaredMime } = await readReference(value, userId);
    assertImageByteLimit(buffer.length);
    totalBytes += buffer.length;
    if (totalBytes > MAX_REFERENCE_TOTAL_BYTES) {
      throw new ApiError("参考图总大小过大", 400, "IMAGE_TOO_LARGE");
    }
    const mime = await inspectImage(buffer, declaredMime);
    normalized.push(`data:${mime};base64,${buffer.toString("base64")}`);
  }

  return normalized;
}

export async function readUpstreamImage(
  item: { b64_json?: string; url?: string },
  baseUrl: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  void baseUrl;
  if (item?.b64_json) {
    const buffer = decodeBase64(item.b64_json);
    await inspectImage(buffer);
    return buffer;
  }
  if (!item?.url) throw new Error("上游未返回图片");

  const result = await requestPublicHttpsBuffer(item.url, {
    timeoutMs: IMAGE_UPSTREAM_TIMEOUT_MS,
    maxBytes: MAX_IMAGE_BYTES,
    signal,
  });
  if (result.status < 200 || result.status >= 300) {
    if (result.status === 408 || result.status === 429 || result.status >= 500) {
      throw new RetryableImageUpstreamError("上游图片下载失败");
    }
    throw new ApiError("上游图片下载失败", 502, "UPSTREAM_IMAGE_ERROR");
  }
  const contentType = headerValue(result.headers, "content-type")
    .split(";", 1)[0]!
    .trim()
    .toLowerCase();
  if (!SUPPORTED_IMAGE_MIME.has(contentType)) {
    throw new ApiError("上游图片格式无效", 502, "UPSTREAM_IMAGE_ERROR");
  }
  await inspectImage(result.body, contentType);
  return result.body;
}

/** 根据图片 buffer 头字节推断扩展名（grok 返回 JPEG，gpt 返回 PNG） */
function detectImageExt(buffer: Buffer): ".png" | ".jpg" | ".webp" {
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return ".webp";
  }
  if (
    buffer.length > 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return ".jpg";
  }
  return ".png";
}

export async function writeFileAtomically(
  filePath: string,
  data: Uint8Array,
): Promise<void> {
  const tempPath = filePath + "." + crypto.randomUUID() + ".tmp";
  let handle: FileHandle | undefined;
  try {
    handle = await open(tempPath, "wx", 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await chmod(tempPath, 0o644);
    await rename(tempPath, filePath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    try {
      await unlink(tempPath);
    } catch {
      /* The temporary path may not have been created. */
    }
    throw error;
  }
}

async function cleanupWrittenPaths(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async (filePath) => {
      try {
        await unlink(filePath);
      } catch {
        /* The path may not have been created or may already be gone. */
      }
    }),
  );
}

export async function readBoundedJsonResponse<T>(
  response: Response,
  maxBytes = MAX_UPSTREAM_JSON_BYTES,
): Promise<T> {
  if (!response.body) throw new Error("上游未返回响应体");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        try {
          await reader.cancel("upstream JSON response too large");
        } catch {
          /* Preserve the bounded-response error. */
        }
        throw new Error("上游响应过大");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function refundImageReservation(
  reservation: CreditReservation,
  note: string,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await reservation.refund(note);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("退款失败");
}

async function writeImageArtifacts(buffer: Buffer): Promise<{
  storageKey: string;
  thumbStorageKey?: string;
  imageUrl: string;
  thumbUrl: string;
  writtenPaths: string[];
}> {
  const imagesDir = privateImageRoot();
  const writtenPaths: string[] = [];
  try {
    await mkdir(imagesDir, { recursive: true });
    const ext = detectImageExt(buffer);
    const filename = `${crypto.randomUUID()}${ext}`;
    const imagePath = path.join(imagesDir, filename);
    await writeFileAtomically(imagePath, buffer);
    writtenPaths.push(imagePath);
    const storageKey = filename;
    const imageUrl = protectedImageUrl(storageKey);

    let thumbUrl = imageUrl;
    let thumbStorageKey: string | undefined;
    let thumbPath: string | undefined;
    try {
      const { default: sharp } = await import("sharp");
      const thumbDir = path.join(imagesDir, "thumbs");
      await mkdir(thumbDir, { recursive: true });
      const thumbName = filename.replace(/\.(png|jpe?g)$/i, ".webp");
      thumbStorageKey = thumbName;
      thumbPath = path.join(thumbDir, thumbName);
      const thumbnail = await sharp(buffer)
        .resize(512, 512, { fit: "inside" })
        .webp({ quality: 80 })
        .toBuffer();
      await writeFileAtomically(thumbPath, thumbnail);
      writtenPaths.push(thumbPath);
      thumbUrl = protectedImageUrl(storageKey, true);
    } catch {
      if (thumbPath && writtenPaths.includes(thumbPath)) {
        await cleanupWrittenPaths([thumbPath]);
        writtenPaths.splice(writtenPaths.indexOf(thumbPath), 1);
      }
      /* Thumbnail failure does not affect the original image. */
    }

    return {
      storageKey,
      thumbStorageKey,
      imageUrl,
      thumbUrl,
      writtenPaths,
    };
  } catch (error) {
    await cleanupWrittenPaths(writtenPaths);
    throw error;
  }
}

export async function generateImage(opts: {
  userId: string;
  /** admin 生图不扣积分 */
  role?: string;
  prompt: string;
  modelOverride?: string;
  size?: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
}) {
  const {
    userId,
    role = "user",
    prompt,
    modelOverride,
    size: requestedSize = "1024x1024",
  } = opts;
  if (opts.signal?.aborted) {
    throw new ApiError("图片生成已取消", 499, "IMAGE_GENERATION_CANCELLED");
  }
  await assertImageGenerationAllowed(role);
  if (!prompt?.trim()) throw new ApiError("prompt 为必填项", 400);
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new ApiError(`提示词不能超过 ${MAX_PROMPT_LENGTH} 字`, 400);
  }

  const config = await getConfig();

  const model =
    modelOverride || config?.imageModel || "doubao-seedream-4-5-251128";

  // 越权防护：模型必须属于管理员启用的列表，
  // 防止普通用户通过 modelOverride 指定任意模型（绕过模型配置 / 调用未授权上游）。
  if (!(await isConfiguredModelEnabled(config || {}, "image", model))) {
    throw new ApiError("指定的模型不可用", 400);
  }
  const size = assertImageSize(requestedSize, model);

  const chargeCredits = role !== "admin";

  const systemPrompt = config?.imageSystemPrompt || "";
  const finalPrompt = systemPrompt
    ? `${systemPrompt}\n\n${prompt}`
    : prompt;

  const { apiKey, baseUrl, maxRetries, enforcePublicHttps } = await resolveConfiguredEndpoint(
    "image",
    model,
    config || {},
  );

  if (!apiKey) {
    const isGrok = model.startsWith("grok-");
    const isGpt = model === "gpt-image-2";
    throw new ApiError(
      isGrok
        ? "请在 .env.local 中设置 GROK_API_KEY"
        : isGpt
          ? "请在 .env.local 中设置 GPT_IMAGE_KEY"
          : "请先在设置中配置 API Key 或在 .env.local 中设置 ARK_API_KEY",
      400,
    );
  }
  if (!baseUrl) {
    throw new ApiError("未配置 API Base URL", 400);
  }

  // 仅 gpt-image-2：标准比例映射到最近原生尺寸生成，落盘前精确裁切；
  // 其他模型（seedream/grok 等）直接用请求 size，不裁切
  const needsCrop = CROP_MODELS.has(model);
  const requestSize = needsCrop ? nearestNativeSize(size) : size;
  let reservation: CreditReservation | null = null;
  let lastError: unknown;
  if (userId && chargeCredits) {
    reservation = await reserveCredits(
      userId,
      CREDIT_PER_IMAGE,
      `预扣生成图片: ${prompt.slice(0, 50)}`,
    );
  }
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const writtenPaths: string[] = [];
    try {
      const res = await postJsonUpstream(
        `${baseUrl}/images/generations`,
        {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(opts.idempotencyKey
            ? {
                "Idempotency-Key": providerIdempotencyKey(
                  "image-generation",
                  opts.idempotencyKey,
                  attempt,
                ),
              }
            : {}),
        },
        JSON.stringify({
          model,
          prompt: finalPrompt,
          n: 1,
          size: requestSize,
          quality: "high",
        }),
        enforcePublicHttps,
        opts.signal,
      );

      if (!res.ok) {
        if (res.status === 408 || res.status === 429 || res.status >= 500) {
          throw new RetryableImageUpstreamError(
            `上游图片服务返回 HTTP ${res.status}`,
          );
        }
        throw new ApiError("上游图片服务请求失败", 502, "UPSTREAM_IMAGE_ERROR");
      }

      const result = await readBoundedJsonResponse<{
        data?: Array<{ b64_json?: string; url?: string }>;
      }>(res);
      const item = result.data?.[0];

      let buffer = await readUpstreamImage(item || {}, baseUrl, opts.signal);

      // 精确裁切到目标比例（fit cover 居中，无变形）；仅 gpt-image-2
      buffer = await preserveOrCropImage(buffer, size, needsCrop);

      const artifacts = await writeImageArtifacts(buffer);
      writtenPaths.push(...artifacts.writtenPaths);

      const [row] = await db
        .insert(imageGenerations)
        .values({
          prompt,
          model,
          imageUrl: artifacts.imageUrl,
          storageKey: artifacts.storageKey,
          thumbStorageKey: artifacts.thumbStorageKey,
          size,
          userId,
        })
        .returning({ id: imageGenerations.id });

      console.log(
        `Image gen success (attempt ${attempt}/${maxRetries}): ${model}`,
      );
      return {
        id: row.id,
        imageUrl: artifacts.imageUrl,
        thumbUrl: artifacts.thumbUrl,
        storageKey: artifacts.storageKey,
        prompt,
        model,
        size,
      };
    } catch (err) {
      lastError = err;
      await cleanupWrittenPaths(writtenPaths);
      console.error(
        `Image gen error (attempt ${attempt}/${maxRetries}):`,
        err instanceof Error ? err.message : err,
      );
      if (opts.signal?.aborted) {
        break;
      } else if (attempt < maxRetries && shouldRetryImageError(err)) {
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        break;
      }
    }
  }

  let refundPending = false;
  if (reservation) {
    try {
      await refundImageReservation(
        reservation,
        `生成失败退回积分: ${prompt.slice(0, 50)}`,
      );
    } catch (refundError) {
      refundPending = true;
      console.error("CRITICAL: 图片生成退款失败，需要人工补偿", refundError);
    }
  }
  if (refundPending) {
    throw new ApiError(
      "图片生成失败，积分退款未完成，请联系客服处理",
      503,
      "CREDIT_REFUND_PENDING",
    );
  }
  if (opts.signal?.aborted) {
    throw new ApiError("图片生成已取消", 499, "IMAGE_GENERATION_CANCELLED");
  }
  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError("图片生成失败，请稍后重试", 502, "UPSTREAM_IMAGE_ERROR");
}

/**
 * 图生图（原图直传编辑）：参考图 + 修改描述 → 上游 /v1/images/edits。
 * 与文生图共享落盘/缩略图/积分/历史逻辑。
 */
/** 单次图生图成功结果 */
export type EditImageResult = {
  id: string;
  imageUrl: string;
  thumbUrl?: string;
  prompt: string;
  model: string;
  size: string;
  storageKey?: string;
};

/** 执行一次上游图像编辑请求并落盘一个结果。 */
async function editImageOnce(opts: {
  userId: string;
  role?: string;
  /** data URL（data:image/...;base64,...）或 http(s) 图片 URL，支持多张（最多 5 张） */
  image: string | string[];
  prompt: string;
  modelOverride?: string;
  size?: string;
  idempotencyKey?: string;
  operationIndex?: number;
}): Promise<EditImageResult> {
  const {
    userId,
    role = "user",
    image,
    prompt,
    modelOverride,
    size: requestedSize = "1024x1024",
  } = opts;
  await assertImageGenerationAllowed(role);
  const images = Array.isArray(image)
    ? image.filter((s) => s?.trim())
    : image?.trim()
      ? [image]
      : [];
  if (images.length === 0) throw new ApiError("image 为必填项", 400);
  if (images.length > 5) throw new ApiError("参考图最多 5 张", 400);
  if (!prompt?.trim()) throw new ApiError("prompt 为必填项", 400);
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new ApiError(`提示词不能超过 ${MAX_PROMPT_LENGTH} 字`, 400);
  }

  const config = await getConfig();
  const model =
    modelOverride || config?.imageModel || "doubao-seedream-4-5-251128";

  // 越权防护：模型必须属于管理员启用的列表
  if (!(await isConfiguredModelEnabled(config || {}, "image", model))) {
    throw new ApiError("指定的模型不可用", 400);
  }

  const size = assertImageSize(requestedSize, model);
  const chargeCredits = role !== "admin";

  const { apiKey, baseUrl, maxRetries, enforcePublicHttps } = await resolveConfiguredEndpoint(
    "image",
    model,
    config || {},
  );
  if (!apiKey) throw new ApiError("请先在设置中配置 API Key", 400);
  if (!baseUrl) throw new ApiError("未配置 API Base URL", 400);

  // 仅 gpt-image-2：标准比例映射到最近原生尺寸，落盘前精确裁切
  const needsCrop = CROP_MODELS.has(model);
  const requestSize = needsCrop ? nearestNativeSize(size) : size;
  // grok2api /v1/images/edits 要求 image 为 {url: dataURL} 对象（不接受裸字符串/URL），
  // 且当前 grok 代理不支持多参考图 → 多图时明确报错
  const isGrok = model.startsWith("grok-");
  if (isGrok && images.length > 1) {
    throw new ApiError("当前模型仅支持单张参考图，请切换模型或减少参考图", 400);
  }
  const normalizedImages = await normalizeReferenceImages(images, userId);
  let reservation: CreditReservation | null = null;
  if (userId && chargeCredits) {
    reservation = await reserveCredits(
      userId,
      CREDIT_PER_IMAGE,
      `预扣图生图: ${prompt.slice(0, 50)}`,
    );
  }

  const editPayload = isGrok
    ? {
        model,
        prompt,
        size: requestSize,
        n: 1,
        image: { url: normalizedImages[0] },
      }
    : {
        model,
        prompt,
        size: requestSize,
        n: 1,
        quality: "high",
        // chatgpt2api /v1/images/edits 支持 JSON 单图或多图引用。
        image:
          normalizedImages.length === 1
            ? normalizedImages[0]
            : normalizedImages,
      };
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const writtenPaths: string[] = [];
    try {
      const res = await postJsonUpstream(
        `${baseUrl}/images/edits`,
        {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(opts.idempotencyKey
            ? {
                "Idempotency-Key": providerIdempotencyKey(
                  "image-edit",
                  opts.idempotencyKey,
                  (opts.operationIndex || 0) * maxRetries + attempt,
                ),
              }
            : {}),
        },
        JSON.stringify(editPayload),
        enforcePublicHttps,
      );

      if (!res.ok) {
        if (res.status === 408 || res.status === 429 || res.status >= 500) {
          throw new RetryableImageUpstreamError(
            `上游图片服务返回 HTTP ${res.status}`,
          );
        }
        throw new ApiError("上游图片服务请求失败", 502, "UPSTREAM_IMAGE_ERROR");
      }

      const result = await readBoundedJsonResponse<{
        data?: Array<{ b64_json?: string; url?: string }>;
      }>(res);
      const item = result.data?.[0];

      let buffer = await readUpstreamImage(item || {}, baseUrl);

      // 精确裁切到目标比例（fit cover 居中，无变形）；仅 gpt-image-2
      buffer = await preserveOrCropImage(buffer, size, needsCrop);

      const artifacts = await writeImageArtifacts(buffer);
      writtenPaths.push(...artifacts.writtenPaths);

      const [row] = await db
        .insert(imageGenerations)
        .values({
          prompt,
          model,
          imageUrl: artifacts.imageUrl,
          storageKey: artifacts.storageKey,
          thumbStorageKey: artifacts.thumbStorageKey,
          size,
          userId,
        })
        .returning({ id: imageGenerations.id });

      console.log(
        `Image edit success (attempt ${attempt}/${maxRetries}): ${model}`,
      );
      return {
        id: row.id,
        imageUrl: artifacts.imageUrl,
        thumbUrl: artifacts.thumbUrl,
        storageKey: artifacts.storageKey,
        prompt,
        model,
        size,
      };
    } catch (err) {
      await cleanupWrittenPaths(writtenPaths);
      console.error(
        `Image edit error (attempt ${attempt}/${maxRetries}):`,
        err instanceof Error ? err.message : err,
      );
      if (attempt < maxRetries && shouldRetryImageError(err)) {
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        break;
      }
    }
  }

  let refundPending = false;
  if (reservation) {
    try {
      await refundImageReservation(
        reservation,
        `图生图失败退回积分: ${prompt.slice(0, 50)}`,
      );
    } catch (refundError) {
      refundPending = true;
      console.error("CRITICAL: 图生图退款失败，需要人工补偿", refundError);
    }
  }
  if (refundPending) {
    throw new ApiError(
      "图生图失败，积分退款未完成，请联系客服处理",
      503,
      "CREDIT_REFUND_PENDING",
    );
  }
  throw new ApiError(PUBLIC_IMAGE_EDIT_ERROR, 502, "UPSTREAM_IMAGE_ERROR");
}

/**
 * 兼容旧调用方：数组图片仍然逐张独立生成。
 * 参考模式由 runImageEditTasks 直接把多图数组交给 editImageOnce。
 */
export async function editImage(opts: {
  userId: string;
  role?: string;
  image: string | string[];
  prompt: string;
  modelOverride?: string;
  size?: string;
  idempotencyKey?: string;
  operationIndex?: number;
}): Promise<EditImageResult | EditImageResult[]> {
  const images = Array.isArray(opts.image)
    ? opts.image.filter((value) => value?.trim())
    : opts.image?.trim()
      ? [opts.image]
      : [];
  if (images.length > 5) {
    throw new ApiError("参考图最多 5 张", 400);
  }
  if (images.length <= 1) {
    return editImageOnce(opts);
  }

  const results: EditImageResult[] = [];
  for (let index = 0; index < images.length; index += 1) {
    results.push(
      await editImageOnce({
        ...opts,
        image: images[index],
        operationIndex: (opts.operationIndex || 0) + index,
      }),
    );
  }
  return results;
}

export async function runImageEditTasks(opts: {
  userId: string;
  role?: string;
  request: ImageEditRequest;
  modelOverride?: string;
  size?: string;
  count?: number;
  idempotencyKey?: string;
}) {
  const {
    userId,
    role = "user",
    request,
    modelOverride,
    size = "1024x1024",
    count = 1,
  } = opts;

  await assertImageGenerationAllowed(role);
  const config = await getConfig();
  const model =
    modelOverride || config?.imageModel || "doubao-seedream-4-5-251128";
  if (!(await isConfiguredModelEnabled(config || {}, "image", model))) {
    throw new ApiError("指定的模型不可用", 400);
  }

  const tasks = normalizeImageEditRequest(request, model);
  const normalizedCount = normalizeImageEditCount(count);
  const chargeCredits = role !== "admin";
  if (userId && chargeCredits) {
    await assertEnoughCredits(
      userId,
      CREDIT_PER_IMAGE * calculateImageEditCost(tasks, normalizedCount),
    );
  }

  const execution = await executeImageEditTasks<EditImageResult>(
    tasks,
    normalizedCount,
    async (task, taskIndex, variantIndex) =>
      editImageOnce({
        userId,
        role,
        image:
          task.mode === "reference"
            ? [task.targetImage, ...task.referenceImages]
            : task.targetImage,
        prompt: task.prompt,
        modelOverride: model,
        size,
        idempotencyKey: opts.idempotencyKey,
        operationIndex: taskIndex * normalizedCount + variantIndex,
      }),
  );

  return {
    images: execution.images.map(({ result, taskIndex, targetIndex }) => ({
      ...result,
      taskIndex,
      targetIndex,
    })),
    total: execution.total,
    succeeded: execution.succeeded,
    failed: execution.failed,
    lastError: execution.lastError,
  };
}

export async function listImageHistory(userId: string, limit = 50) {
  const rows = await db
    .select()
    .from(imageGenerations)
    .where(eq(imageGenerations.userId, userId))
    .orderBy(desc(imageGenerations.createdAt))
    .limit(limit);

  return Promise.all(
    rows.map(async (row) => {
      if (row.storageKey) {
        const imageUrl = protectedImageUrl(row.storageKey);
        if (row.thumbStorageKey) {
          try {
            await access(privateThumbnailPath(privateImageRoot(), row.storageKey));
            return {
              ...row,
              imageUrl,
              thumbUrl: protectedImageUrl(row.storageKey, true),
            };
          } catch {
            return { ...row, imageUrl };
          }
        }
        return { ...row, imageUrl };
      }

      // 兼容迁移前的历史记录；middleware 会阻断其直接静态访问。
      const legacyKeyMatch =
        /^\/images\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp))$/i.exec(
          row.imageUrl,
        );
      if (!legacyKeyMatch) return row;
      const legacyKey = legacyKeyMatch[1]!;
      const thumbDir = path.join(process.cwd(), "public", "images", "thumbs");
      const thumbFile = path.join(
        thumbDir,
        legacyKey.replace(/\.(png|jpe?g)$/i, ".webp"),
      );
      try {
        await access(thumbFile);
        return {
          ...row,
          imageUrl: protectedLegacyImageUrl(legacyKey),
          thumbUrl: protectedLegacyImageUrl(legacyKey, true),
        };
      } catch {
        return { ...row, imageUrl: protectedLegacyImageUrl(legacyKey) };
      }
    }),
  );
}

export async function deleteImageRecord(userId: string, id: string) {
  const rows = await db
    .select()
    .from(imageGenerations)
    .where(
      and(eq(imageGenerations.id, id), eq(imageGenerations.userId, userId)),
    );
  const record = rows[0];
  if (!record) throw new ApiError("记录不存在", 404);

  try {
    const filePath = record.storageKey
      ? privateImagePath(privateImageRoot(), record.storageKey)
      : path.join(process.cwd(), "public", record.imageUrl);
    await unlink(filePath);
  } catch {
    /* file may already be gone */
  }
  // 同步删除缩略图（存在才删）
  try {
    const thumbPath = record.storageKey
      ? privateThumbnailPath(privateImageRoot(), record.storageKey)
      : path.join(
          process.cwd(),
          "public",
          "images",
          "thumbs",
          record.imageUrl
            .split("/")
            .pop()!
            .replace(/\.(png|jpe?g)$/i, ".webp"),
        );
    await unlink(thumbPath);
  } catch {
    /* thumbnail may not exist */
  }

  await db.delete(imageGenerations).where(eq(imageGenerations.id, id));
  return { success: true };
}

/**
 * 批量图生图（同参考图 + 描述，生成 N 张变体，最大 5 张）。
 * 积分策略（无竞态）：
 * 1. 生成前一次性校验余额 >= 5 × n，不足直接拒绝（不扣款）
 * 2. 逐张生成，每次用一次性积分预扣；失败时幂等退款
 * 3. 单张失败跳过继续，返回成功/失败计数；最终扣款 = 成功张数
 */
export async function editImageBatch(opts: {
  userId: string;
  role?: string;
  image: string | string[];
  prompt: string;
  modelOverride?: string;
  size?: string;
  count?: number;
}) {
  const {
    userId,
    role = "user",
    image,
    prompt,
    modelOverride,
    size = "1024x1024",
    count = 1,
  } = opts;

  await assertImageGenerationAllowed(role);

  const images = Array.isArray(image)
    ? image.filter((s) => s?.trim())
    : image?.trim()
      ? [image]
      : [];
  if (images.length === 0) throw new ApiError("image 为必填项", 400);
  if (images.length > 5) throw new ApiError("参考图最多 5 张", 400);
  if (!prompt?.trim()) throw new ApiError("prompt 为必填项", 400);
  const n = Math.min(Math.max(Math.floor(count) || 1, 1), 5);
  if (n > 1 && prompt.length > MAX_PROMPT_LENGTH) {
    throw new ApiError(`提示词不能超过 ${MAX_PROMPT_LENGTH} 字`, 400);
  }

  const chargeCredits = role !== "admin";
  // 预校验总额度（不足直接拒绝，不扣款）：参考图张数 × 每张变体数
  if (userId && chargeCredits) {
    await assertEnoughCredits(userId, CREDIT_PER_IMAGE * n * images.length);
  }

  const results: Awaited<ReturnType<typeof editImage>>[] = [];
  let failed = 0;
  let lastError: string | null = null;

  // 串行生成：每张参考图独立生成 n 张变体（避免并发打爆上游配额；每张独立原子扣款）
  for (const img of images) {
    for (let i = 0; i < n; i++) {
      try {
        const r = await editImage({
          userId,
          role,
          image: img,
          prompt,
          modelOverride,
          size,
        });
        // 单图调用总是返回单个结果对象
        results.push(r as EditImageResult);
      } catch (err) {
        failed += 1;
        lastError = err instanceof Error ? err.message : "生成失败";
      }
    }
  }

  return {
    images: results,
    total: n * images.length,
    succeeded: results.length,
    failed,
    lastError,
  };
}
