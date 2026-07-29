import { db } from "@/db";
import { imageGenerations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getConfig } from "@/lib/config";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { CREDIT_PER_IMAGE } from "@/types";
import { ApiError } from "@/server/http";
import { resolveImageEndpoint } from "@/server/providers/llm";
import { assertEnoughCredits, consumeCredits } from "@/server/services/credits";

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

  const config = await getConfig();

  const model =
    modelOverride || config?.imageModel || "doubao-seedream-4-5-251128";

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
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, prompt: finalPrompt, n: 1, size }),
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

      const imagesDir = path.join(process.cwd(), "public", "images");
      await mkdir(imagesDir, { recursive: true });
      const filename = `${crypto.randomUUID()}.png`;
      await writeFile(path.join(imagesDir, filename), buffer);
      const imageUrl = `/images/${filename}`;

      await db.insert(imageGenerations).values({
        prompt,
        model,
        imageUrl,
        size,
        userId,
      });

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
        id: crypto.randomUUID(),
        imageUrl,
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

export async function listImageHistory(userId: string, limit = 50) {
  return db
    .select()
    .from(imageGenerations)
    .where(eq(imageGenerations.userId, userId))
    .orderBy(desc(imageGenerations.createdAt))
    .limit(limit);
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

  await db.delete(imageGenerations).where(eq(imageGenerations.id, id));
  return { success: true };
}
