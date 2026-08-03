import { db } from "@/db";
import { imageGenerations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  defaultImageModelIds,
  getConfig,
  parseEnabledModels,
} from "@/lib/config";
import { writeFile, mkdir, unlink, access } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { CREDIT_PER_IMAGE } from "@/types";
import { ApiError } from "@/server/http";
import { resolveImageEndpoint } from "@/server/providers/llm";
import { assertEnoughCredits, consumeCredits } from "@/server/services/credits";

const MAX_PROMPT_LENGTH = 2000;

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
    return { buffer, size: target };
  }
}

export async function generateImage(opts: {
  userId: string;
  /** admin 生图不扣积分 */
  role?: string;
  prompt: string;
  modelOverride?: string;
  size?: string;
}) {
  const {
    userId,
    role = "user",
    prompt,
    modelOverride,
    size = "1024x1024",
  } = opts;
  if (!prompt?.trim()) throw new ApiError("prompt 为必填项", 400);
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new ApiError(`提示词不能超过 ${MAX_PROMPT_LENGTH} 字`, 400);
  }

  const config = await getConfig();

  const model =
    modelOverride || config?.imageModel || "doubao-seedream-4-5-251128";

  // 越权防护：模型必须属于管理员启用的列表，
  // 防止普通用户通过 modelOverride 指定任意模型（绕过模型配置 / 调用未授权上游）。
  const enabledModels = parseEnabledModels(
    config?.enabledImageModels,
    defaultImageModelIds(),
    config?.imageModel,
  );
  if (!enabledModels.includes(model)) {
    throw new ApiError("指定的模型不可用", 400);
  }

  const chargeCredits = role !== "admin";
  if (userId && chargeCredits) {
    await assertEnoughCredits(userId, CREDIT_PER_IMAGE);
  }

  const systemPrompt = config?.imageSystemPrompt || "";
  const finalPrompt = systemPrompt
    ? `${systemPrompt}\n\n${prompt}`
    : prompt;

  const { apiKey, baseUrl, maxRetries } = resolveImageEndpoint(
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

  let lastError: unknown;
  // 仅 gpt-image-2：标准比例映射到最近原生尺寸生成，落盘前精确裁切；
  // 其他模型（seedream/grok 等）直接用请求 size，不裁切
  const needsCrop = CROP_MODELS.has(model);
  const requestSize = needsCrop ? nearestNativeSize(size) : size;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: finalPrompt,
          n: 1,
          size: requestSize,
          quality: "high",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status} ${errText}`);
      }

      const result = await res.json();
      const item = result.data?.[0];

      let buffer: Buffer;
      if (item?.b64_json) {
        buffer = Buffer.from(item.b64_json, "base64");
      } else if (item?.url) {
        const imageRes = await fetch(item.url);
        buffer = Buffer.from(await imageRes.arrayBuffer());
      } else {
        throw new Error("未能生成图片");
      }

      // 精确裁切到目标比例（fit cover 居中，无变形）；仅 gpt-image-2
      if (needsCrop) {
        const cropped = await cropToSize(buffer, size);
        buffer = cropped.buffer;
      }

      const imagesDir = path.join(process.cwd(), "public", "images");
      await mkdir(imagesDir, { recursive: true });
      const filename = `${crypto.randomUUID()}.png`;
      await writeFile(path.join(imagesDir, filename), buffer);
      const imageUrl = `/images/${filename}`;

      // 同步生成 webp 缩略图（列表/历史用，省 90%+ 流量；预览仍用原图）
      let thumbUrl = imageUrl;
      try {
        const { default: sharp } = await import("sharp");
        const thumbDir = path.join(imagesDir, "thumbs");
        await mkdir(thumbDir, { recursive: true });
        const thumbName = filename.replace(/\.png$/i, ".webp");
        await sharp(buffer).resize(512, 512, { fit: "inside" }).webp({ quality: 80 }).toFile(path.join(thumbDir, thumbName));
        thumbUrl = `/images/thumbs/${thumbName}`;
      } catch {
        /* 缩略图失败不影响生图主流程 */
      }

      const [row] = await db
        .insert(imageGenerations)
        .values({
          prompt,
          model,
          imageUrl,
          size,
          userId,
        })
        .returning({ id: imageGenerations.id });

      if (userId && chargeCredits) {
        await consumeCredits(
          userId,
          CREDIT_PER_IMAGE,
          `生成图片: ${prompt.slice(0, 50)}`,
        );
      }

      console.log(
        `Image gen success (attempt ${attempt}/${maxRetries}): ${model}`,
      );
      return {
        id: row.id,
        imageUrl,
        thumbUrl,
        prompt,
        model,
        size,
      };
    } catch (err) {
      lastError = err;
      console.error(
        `Image gen error (attempt ${attempt}/${maxRetries}):`,
        err instanceof Error ? err.message : err,
      );
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  const msg =
    lastError instanceof Error ? lastError.message : "未知错误";
  throw new ApiError(`图片生成出错: ${msg}`, 500);
}

/**
 * 图生图（原图直传编辑）：参考图 + 修改描述 → 上游 /v1/images/edits。
 * 与文生图共享落盘/缩略图/积分/历史逻辑。
 */
export async function editImage(opts: {
  userId: string;
  role?: string;
  /** data URL（data:image/...;base64,...）或 http(s) 图片 URL */
  image: string;
  prompt: string;
  modelOverride?: string;
  size?: string;
}) {
  const {
    userId,
    role = "user",
    image,
    prompt,
    modelOverride,
    size = "1024x1024",
  } = opts;
  if (!image?.trim()) throw new ApiError("image 为必填项", 400);
  if (!prompt?.trim()) throw new ApiError("prompt 为必填项", 400);
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new ApiError(`提示词不能超过 ${MAX_PROMPT_LENGTH} 字`, 400);
  }

  const config = await getConfig();
  const model =
    modelOverride || config?.imageModel || "doubao-seedream-4-5-251128";

  // 越权防护：模型必须属于管理员启用的列表
  const enabledModels = parseEnabledModels(
    config?.enabledImageModels,
    defaultImageModelIds(),
    config?.imageModel,
  );
  if (!enabledModels.includes(model)) {
    throw new ApiError("指定的模型不可用", 400);
  }

  const chargeCredits = role !== "admin";
  if (userId && chargeCredits) {
    await assertEnoughCredits(userId, CREDIT_PER_IMAGE);
  }

  const { apiKey, baseUrl, maxRetries } = resolveImageEndpoint(
    model,
    config || {},
  );
  if (!apiKey) throw new ApiError("请先在设置中配置 API Key", 400);
  if (!baseUrl) throw new ApiError("未配置 API Base URL", 400);

  let lastError: unknown;
  // 仅 gpt-image-2：标准比例映射到最近原生尺寸，落盘前精确裁切
  const needsCrop = CROP_MODELS.has(model);
  const requestSize = needsCrop ? nearestNativeSize(size) : size;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/images/edits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          size: requestSize,
          n: 1,
          quality: "high",
          // gpt2api /v1/images/edits 支持 JSON 原图引用（data URL 或 URL）
          image,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${res.status} ${errText}`);
      }

      const result = await res.json();
      const item = result.data?.[0];

      let buffer: Buffer;
      if (item?.b64_json) {
        buffer = Buffer.from(item.b64_json, "base64");
      } else if (item?.url) {
        const imageRes = await fetch(item.url);
        buffer = Buffer.from(await imageRes.arrayBuffer());
      } else {
        throw new Error("未能生成图片");
      }

      // 精确裁切到目标比例（fit cover 居中，无变形）；仅 gpt-image-2
      if (needsCrop) {
        const cropped = await cropToSize(buffer, size);
        buffer = cropped.buffer;
      }

      const imagesDir = path.join(process.cwd(), "public", "images");
      await mkdir(imagesDir, { recursive: true });
      const filename = `${crypto.randomUUID()}.png`;
      await writeFile(path.join(imagesDir, filename), buffer);
      const imageUrl = `/images/${filename}`;

      let thumbUrl = imageUrl;
      try {
        const { default: sharp } = await import("sharp");
        const thumbDir = path.join(imagesDir, "thumbs");
        await mkdir(thumbDir, { recursive: true });
        const thumbName = filename.replace(/\.png$/i, ".webp");
        await sharp(buffer).resize(512, 512, { fit: "inside" }).webp({ quality: 80 }).toFile(path.join(thumbDir, thumbName));
        thumbUrl = `/images/thumbs/${thumbName}`;
      } catch {
        /* 缩略图失败不影响主流程 */
      }

      const [row] = await db
        .insert(imageGenerations)
        .values({
          prompt,
          model,
          imageUrl,
          size,
          userId,
        })
        .returning({ id: imageGenerations.id });

      if (userId && chargeCredits) {
        await consumeCredits(
          userId,
          CREDIT_PER_IMAGE,
          `图生图: ${prompt.slice(0, 50)}`,
        );
      }

      console.log(
        `Image edit success (attempt ${attempt}/${maxRetries}): ${model}`,
      );
      return {
        id: row.id,
        imageUrl,
        thumbUrl,
        prompt,
        model,
        size,
      };
    } catch (err) {
      lastError = err;
      console.error(
        `Image edit error (attempt ${attempt}/${maxRetries}):`,
        err instanceof Error ? err.message : err,
      );
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : "未知错误";
  throw new ApiError(`图生图失败: ${msg}`, 500);
}

export async function listImageHistory(userId: string, limit = 50) {
  const rows = await db
    .select()
    .from(imageGenerations)
    .where(eq(imageGenerations.userId, userId))
    .orderBy(desc(imageGenerations.createdAt))
    .limit(limit);

  // 为已有缩略图的记录附加 thumbUrl（历史图片无缩略图时回落原图）
  const thumbDir = path.join(process.cwd(), "public", "images", "thumbs");
  return Promise.all(
    rows.map(async (row) => {
      const base = row.imageUrl.replace(/^\//, "");
      const thumbFile = path.join(
        thumbDir,
        base.replace(/\.png$/i, ".webp").replace(/^images\//, ""),
      );
      try {
        await access(thumbFile);
        return {
          ...row,
          thumbUrl: `/images/thumbs/${base.replace(/\.png$/i, ".webp").replace(/^images\//, "")}`,
        };
      } catch {
        return row;
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
    const filePath = path.join(process.cwd(), "public", record.imageUrl);
    await unlink(filePath);
  } catch {
    /* file may already be gone */
  }
  // 同步删除缩略图（存在才删）
  try {
    const thumbPath = path.join(
      process.cwd(),
      "public",
      "images",
      "thumbs",
      record.imageUrl.split("/").pop()!.replace(/\.png$/i, ".webp"),
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
 * 2. 逐张生成，成功一张原子扣 5 积分（consumeCredits 自带 WHERE credits>=amount）
 * 3. 单张失败跳过继续，返回成功/失败计数；已扣积分 = 成功张数，与单张生成一致
 */
export async function editImageBatch(opts: {
  userId: string;
  role?: string;
  image: string;
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

  if (!image?.trim()) throw new ApiError("image 为必填项", 400);
  if (!prompt?.trim()) throw new ApiError("prompt 为必填项", 400);
  const n = Math.min(Math.max(Math.floor(count) || 1, 1), 5);
  if (n > 1 && prompt.length > MAX_PROMPT_LENGTH) {
    throw new ApiError(`提示词不能超过 ${MAX_PROMPT_LENGTH} 字`, 400);
  }

  const chargeCredits = role !== "admin";
  // 预校验总额度（不足直接拒绝，不扣款）
  if (userId && chargeCredits) {
    await assertEnoughCredits(userId, CREDIT_PER_IMAGE * n);
  }

  const results: Awaited<ReturnType<typeof editImage>>[] = [];
  let failed = 0;
  let lastError: string | null = null;

  // 串行生成：避免并发打爆上游配额；每张独立原子扣款
  for (let i = 0; i < n; i++) {
    try {
      const r = await editImage({
        userId,
        role,
        image,
        prompt,
        modelOverride,
        size,
      });
      results.push(r);
    } catch (err) {
      failed += 1;
      lastError = err instanceof Error ? err.message : "生成失败";
    }
  }

  return {
    images: results,
    total: n,
    succeeded: results.length,
    failed,
    lastError,
  };
}
