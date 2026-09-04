import { db } from "@/db";
import { llmConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  defaultImageModelIds,
  defaultTextModelIds,
  getConfig,
  hasAnyApiCredential,
  parseEnabledModels,
  serializeModelIds,
} from "@/lib/config";
import { requireAdmin, requireActiveUser } from "@/server/auth";
import { normalizeBaseUrl } from "@/server/providers/llm";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { isImageGenerationEnabled } from "@/server/services/site-settings";
import { encryptLlmConfigKey } from "@/server/services/llm-config-crypto";
import { DEFAULT_ASSISTANT_IMAGE_PROMPT } from "@/lib/conversational-image-intent";
import {
  listDefaultModelIdsFromViews,
  listModelChannels,
  replaceModelChannels,
  type ChannelPayloadInput,
} from "@/server/services/model-channels";

function mask(key: string) {
  if (!key || key.length < 8) return key ? "****" : "";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function isMaskedKey(key: string | undefined): boolean {
  return !!key && key.includes("****");
}

function publicConfig(
  config: NonNullable<Awaited<ReturnType<typeof getConfig>>>,
  channels?: Awaited<ReturnType<typeof listModelChannels>>,
  configuredChannels = channels,
) {
  const isAdminView = channels !== undefined;
  const hasChannelCredential = Boolean(
    configuredChannels?.some((channel) => channel.apiKeyHint),
  );
  const hasCredential = hasAnyApiCredential(config) || hasChannelCredential;
  const channelTextModels = configuredChannels
    ? listDefaultModelIdsFromViews(configuredChannels, "text")
    : [];
  const channelImageModels = configuredChannels
    ? listDefaultModelIdsFromViews(configuredChannels, "image")
    : [];
  const enabledTextModels = parseEnabledModels(
    config.enabledTextModels,
    defaultTextModelIds(),
    config.textModel,
  );
  const enabledImageModels = parseEnabledModels(
    config.enabledImageModels,
    defaultImageModelIds(),
    config.imageModel,
  );
  const visibleTextModels = channelTextModels.length
    ? channelTextModels
    : enabledTextModels;
  const visibleImageModels = channelImageModels.length
    ? channelImageModels
    : enabledImageModels;
  const textModel = visibleTextModels.includes(config.textModel)
    ? config.textModel
    : visibleTextModels[0] || config.textModel;
  const imageModel = visibleImageModels.includes(config.imageModel)
    ? config.imageModel
    : visibleImageModels[0] || config.imageModel;

  return {
    id: config.id,
    baseUrl: isAdminView ? config.baseUrl : "",
    textModel,
    imageModel,
    imageSystemPrompt: config.imageSystemPrompt,
    assistantImagePrompt:
      config.assistantImagePrompt || DEFAULT_ASSISTANT_IMAGE_PROMPT,
    reversePromptModel: config.reversePromptModel || "",
    updatedAt: config.updatedAt,
    arkApiKey: "",
    hasApiKey: hasCredential,
    apiKeyHint: isAdminView
      ? config.arkApiKey
        ? mask(config.arkApiKey)
        : hasChannelCredential
          ? "渠道"
          : hasCredential
            ? "env"
            : ""
      : "",
    enabledTextModels: visibleTextModels,
    enabledImageModels: visibleImageModels,
    ...(channels && channels.length > 0 ? { channels } : {}),
  };
}

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiError("enabledImageModels 必须是字符串数组", 400);
  }
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

// GET /api/config
export const GET = handleRoute(async (req) => {
  // 配置含上游 Base URL 与 key 掩码，仅登录用户可读
  const user = await requireActiveUser(req);
  const config = await getConfig();
  if (!config) throw new ApiError("未找到配置", 404);
  const configuredChannels = await listModelChannels();
  const channels = user.role === "admin" ? configuredChannels : undefined;
  return jsonOk({
    ...publicConfig(config, channels, configuredChannels),
    imageGenerationEnabled: await isImageGenerationEnabled(),
  });
});

// PUT /api/config — 仅管理员可修改
export const PUT = handleRoute(async (req) => {
  await requireAdmin(req);
  const body = await readJson<Record<string, unknown>>(req);
  const updates: Record<string, unknown> = {};
  const channelPayload =
    body.channels === undefined
      ? undefined
      : (body.channels as ChannelPayloadInput[]);
  if (channelPayload !== undefined && !Array.isArray(channelPayload)) {
    throw new ApiError("channels 必须是数组", 400);
  }

  if (body.arkApiKey !== undefined) {
    const key = String(body.arkApiKey ?? "").trim();
    if (key && !isMaskedKey(key)) {
      const encrypted = encryptLlmConfigKey(key);
      updates.arkApiKey = encrypted.plaintext;
      updates.arkApiKeyCiphertext = encrypted.ciphertext;
      updates.arkApiKeyIv = encrypted.iv;
      updates.arkApiKeyAuthTag = encrypted.authTag;
    }
  }
  if (body.baseUrl !== undefined) {
    const normalized = normalizeBaseUrl(String(body.baseUrl ?? ""));
    if (!normalized) throw new ApiError("API Base URL 不能为空", 400);
    updates.baseUrl = normalized;
  }
  if (body.imageModel !== undefined) {
    const m = String(body.imageModel ?? "").trim();
    if (!m) throw new ApiError("文生图模型不能为空", 400);
    updates.imageModel = m;
  }
  if (body.textModel !== undefined) {
    const m = String(body.textModel ?? "").trim();
    if (!m) throw new ApiError("对话模型不能为空", 400);
    updates.textModel = m;
  }
  if (body.imageSystemPrompt !== undefined) {
    updates.imageSystemPrompt = String(body.imageSystemPrompt ?? "");
  }
  if (body.assistantImagePrompt !== undefined) {
    updates.assistantImagePrompt = String(body.assistantImagePrompt ?? "");
  }
  if (body.reversePromptModel !== undefined) {
    updates.reversePromptModel = String(body.reversePromptModel ?? "").trim();
  }

  const enabledImage = asStringArray(body.enabledImageModels);
  if (enabledImage !== undefined) {
    if (enabledImage.length === 0) {
      throw new ApiError("至少保留一个文生图模型", 400);
    }
    updates.enabledImageModels = serializeModelIds(enabledImage);
  }

  const enabledText = asStringArray(body.enabledTextModels);
  if (enabledText !== undefined) {
    if (enabledText.length === 0) {
      throw new ApiError("至少保留一个对话模型", 400);
    }
    updates.enabledTextModels = serializeModelIds(enabledText);
  }

  if (channelPayload !== undefined) {
    await replaceModelChannels(channelPayload);
  }

  if (Object.keys(updates).length === 0 && channelPayload === undefined) {
    throw new ApiError(
      "没有需要更新的字段（若只改 API Key，请重新完整输入）",
      400,
    );
  }

  updates.updatedAt = new Date();

  const [row] = await db
    .update(llmConfig)
    .set(updates)
    .where(eq(llmConfig.id, 1))
    .returning({ id: llmConfig.id });

  if (!row) {
    await db.insert(llmConfig).values({
      id: 1,
      arkApiKey: (updates.arkApiKey as string) || "",
      arkApiKeyCiphertext: (updates.arkApiKeyCiphertext as string) || null,
      arkApiKeyIv: (updates.arkApiKeyIv as string) || null,
      arkApiKeyAuthTag: (updates.arkApiKeyAuthTag as string) || null,
      baseUrl: (updates.baseUrl as string) || "",
      imageModel:
        (updates.imageModel as string) || "doubao-seedream-4-5-251128",
      imageSystemPrompt: (updates.imageSystemPrompt as string) || "",
      assistantImagePrompt:
        (updates.assistantImagePrompt as string) || "",
      reversePromptModel: (updates.reversePromptModel as string) || "",
      enabledImageModels:
        (updates.enabledImageModels as string) ||
        serializeModelIds(defaultImageModelIds()),
      updatedAt: new Date(),
    });
  }

  // 若更新了默认模型但不在启用列表，自动加入
  const latest = await getConfig();
  if (latest) {
    const pinUpdates: Record<string, unknown> = {};
    const imageEnabled = parseEnabledModels(
      latest.enabledImageModels,
      defaultImageModelIds(),
    );
    if (latest.imageModel && !imageEnabled.includes(latest.imageModel)) {
      pinUpdates.enabledImageModels = serializeModelIds([
        latest.imageModel,
        ...imageEnabled,
      ]);
    }
    const textEnabled = parseEnabledModels(
      latest.enabledTextModels,
      defaultTextModelIds(),
    );
    if (latest.textModel && !textEnabled.includes(latest.textModel)) {
      pinUpdates.enabledTextModels = serializeModelIds([
        latest.textModel,
        ...textEnabled,
      ]);
    }
    if (Object.keys(pinUpdates).length) {
      await db
        .update(llmConfig)
        .set({ ...pinUpdates, updatedAt: new Date() })
        .where(eq(llmConfig.id, 1));
    }
  }

  const config = await getConfig();
  if (!config) throw new ApiError("未找到配置", 404);
  const channels = await listModelChannels();
  return jsonOk(publicConfig(config, channels, channels));
});
