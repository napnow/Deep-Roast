import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { llmChannelModels, llmChannels } from "@/db/schema";
import {
  normalizeBaseUrl,
  resolveChatEndpoint,
  resolveImageEndpoint,
  resolveVisionEndpoint,
  type UpstreamEndpoint,
} from "@/server/providers/llm";
import { assertPublicHttpsUrl } from "@/server/safe-http";
import {
  decryptLlmConfigKey,
  encryptLlmConfigKey,
} from "@/server/services/llm-config-crypto";

export type ModelChannelKind = "text" | "image";
export type ConfiguredEndpointKind = ModelChannelKind | "vision";

export interface ChannelBindingRecord {
  channelId: string;
  channelName: string;
  baseUrl: string;
  apiKey: string;
  channelEnabled: boolean;
  modelId: string;
  kind: ModelChannelKind;
  modelEnabled: boolean;
  isDefault: boolean;
}

export interface ChannelModelView {
  id?: string;
  modelId: string;
  kind: ModelChannelKind;
  enabled: boolean;
  isDefault: boolean;
  sortOrder?: number;
}

export interface ModelChannelView {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyHint: string;
  enabled: boolean;
  sortOrder: number;
  models: ChannelModelView[];
}

export interface ChannelModelInput {
  modelId: string;
  kind: ModelChannelKind;
  enabled?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface ChannelPayloadInput {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  enabled?: boolean;
  sortOrder?: number;
  models: ChannelModelInput[];
}

interface LegacyConfigShape {
  arkApiKey?: string | null;
  baseUrl?: string | null;
  textModel?: string | null;
  imageModel?: string | null;
  enabledTextModels?: string[] | string | null;
  enabledImageModels?: string[] | string | null;
}

interface StoredModelChannelKey {
  apiKey?: string | null;
  apiKeyCiphertext?: string | null;
  apiKeyIv?: string | null;
  apiKeyAuthTag?: string | null;
}

export function encryptModelChannelKey(
  plainKey: string,
  encodedKey?: string,
) {
  return encryptLlmConfigKey(plainKey, encodedKey);
}

export function resolveModelChannelKey(
  row: StoredModelChannelKey,
  encodedKey = process.env.API_KEY_ENCRYPTION_KEY,
): string {
  if (row.apiKeyCiphertext && row.apiKeyIv && row.apiKeyAuthTag) {
    return decryptLlmConfigKey(
      {
        ciphertext: row.apiKeyCiphertext,
        iv: row.apiKeyIv,
        authTag: row.apiKeyAuthTag,
      },
      encodedKey,
    );
  }
  return row.apiKey?.trim() || "";
}

function maskKey(key: string) {
  if (!key || key.length < 8) return key ? "****" : "";
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

function isMissingRelation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "42P01"
  );
}

function parseLegacyModelIds(raw: string[] | string | null | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((id): id is string => typeof id === "string" && !!id.trim())
      .map((id) => id.trim());
  }
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter((id): id is string => typeof id === "string" && !!id.trim())
          .map((id) => id.trim())
      : [];
  } catch {
    return [];
  }
}

export function selectDefaultBinding(
  bindings: ChannelBindingRecord[],
  kind: ModelChannelKind,
  modelId: string,
): ChannelBindingRecord | null {
  return (
    bindings.find(
      (binding) =>
        binding.kind === kind &&
        binding.modelId === modelId &&
        binding.channelEnabled &&
        binding.modelEnabled &&
        binding.isDefault,
    ) ?? null
  );
}

export function listDefaultModelIds(
  bindings: ChannelBindingRecord[],
  kind: ModelChannelKind,
): string[] {
  return [
    ...new Set(
      bindings
        .filter(
          (binding) =>
            binding.kind === kind &&
            binding.channelEnabled &&
            binding.modelEnabled &&
            binding.isDefault,
        )
        .map((binding) => binding.modelId),
    ),
  ];
}

export function listDefaultModelIdsFromViews(
  channels: ModelChannelView[],
  kind: ModelChannelKind,
): string[] {
  return [
    ...new Set(
      channels
        .filter((channel) => channel.enabled)
        .flatMap((channel) =>
          channel.models
            .filter(
              (model) =>
                model.kind === kind && model.enabled && model.isDefault,
            )
            .map((model) => model.modelId),
        ),
    ),
  ];
}

export function normalizeChannelPayload(
  channels: ChannelPayloadInput[],
): ChannelPayloadInput[] {
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new Error("至少保留一个模型渠道");
  }

  const defaults = new Set<string>();
  const seenNames = new Set<string>();

  return channels.map((channel, channelIndex) => {
    const name = String(channel.name ?? "").trim();
    const baseUrl = normalizeBaseUrl(String(channel.baseUrl ?? ""));
    if (!name) throw new Error(`第 ${channelIndex + 1} 个渠道名称不能为空`);
    if (seenNames.has(name)) throw new Error(`渠道名称重复：${name}`);
    seenNames.add(name);
    if (!baseUrl) throw new Error(`渠道“${name}”的 Base URL 不能为空`);
    assertPublicHttpsUrl(baseUrl);
    const channelEnabled = channel.enabled !== false;

    const seenModels = new Set<string>();
    const models = (Array.isArray(channel.models) ? channel.models : []).map(
      (model, modelIndex) => {
        const modelId = String(model.modelId ?? "").trim();
        const kind = model.kind;
        if (!modelId) {
          throw new Error(`渠道“${name}”第 ${modelIndex + 1} 个模型 ID 不能为空`);
        }
        if (kind !== "text" && kind !== "image") {
          throw new Error(`渠道“${name}”包含无效模型类型`);
        }
        const modelKey = `${kind}:${modelId}`;
        if (seenModels.has(modelKey)) {
          throw new Error(`渠道“${name}”中的模型重复：${modelId}`);
        }
        seenModels.add(modelKey);

        const enabled = model.enabled !== false;
        const isDefault = model.isDefault === true;
        if (isDefault && (!enabled || !channelEnabled)) {
          throw new Error(`默认模型“${modelId}”必须处于启用状态`);
        }
        if (isDefault) {
          const defaultKey = `${kind}:${modelId}`;
          if (defaults.has(defaultKey)) {
            throw new Error(`模型“${modelId}”只能设置一个默认渠道`);
          }
          defaults.add(defaultKey);
        }

        return {
          modelId,
          kind,
          enabled,
          isDefault,
          sortOrder: Number.isFinite(model.sortOrder)
            ? Math.max(0, Math.floor(model.sortOrder as number))
            : modelIndex,
        } satisfies ChannelModelInput;
      },
    );

    return {
      id: channel.id,
      name,
      baseUrl,
      apiKey: channel.apiKey?.includes("****") ? undefined : channel.apiKey?.trim(),
      enabled: channelEnabled,
      sortOrder: Number.isFinite(channel.sortOrder)
        ? Math.max(0, Math.floor(channel.sortOrder as number))
        : channelIndex,
      models,
    } satisfies ChannelPayloadInput;
  });
}

export async function listChannelBindings(): Promise<ChannelBindingRecord[]> {
  try {
    const rows = await db
      .select({
        channelId: llmChannels.id,
        channelName: llmChannels.name,
        baseUrl: llmChannels.baseUrl,
        apiKey: llmChannels.apiKey,
        apiKeyCiphertext: llmChannels.apiKeyCiphertext,
        apiKeyIv: llmChannels.apiKeyIv,
        apiKeyAuthTag: llmChannels.apiKeyAuthTag,
        channelEnabled: llmChannels.enabled,
        modelId: llmChannelModels.modelId,
        kind: llmChannelModels.kind,
        modelEnabled: llmChannelModels.enabled,
        isDefault: llmChannelModels.isDefault,
      })
      .from(llmChannelModels)
      .innerJoin(llmChannels, eq(llmChannelModels.channelId, llmChannels.id))
      .orderBy(asc(llmChannels.sortOrder), asc(llmChannelModels.sortOrder));

    return rows.flatMap((row) => {
      if (row.kind !== "text" && row.kind !== "image") return [];
      return [{
        channelId: row.channelId,
        channelName: row.channelName,
        baseUrl: row.baseUrl,
        apiKey: resolveModelChannelKey(row),
        channelEnabled: row.channelEnabled === 1,
        modelId: row.modelId,
        kind: row.kind,
        modelEnabled: row.modelEnabled === 1,
        isDefault: row.isDefault === 1,
      } satisfies ChannelBindingRecord];
    });
  } catch (error) {
    if (!isMissingRelation(error)) {
      console.warn("读取模型渠道失败，回退旧配置:", error);
    }
    return [];
  }
}

export async function listModelChannels(): Promise<ModelChannelView[]> {
  try {
    const channels = await db
      .select()
      .from(llmChannels)
      .orderBy(asc(llmChannels.sortOrder), asc(llmChannels.createdAt));
    const models = await db
      .select()
      .from(llmChannelModels)
      .orderBy(asc(llmChannelModels.sortOrder), asc(llmChannelModels.createdAt));
    const modelsByChannel = new Map<string, ChannelModelView[]>();
    for (const model of models) {
      if (model.kind !== "text" && model.kind !== "image") continue;
      const list = modelsByChannel.get(model.channelId) ?? [];
      list.push({
        id: model.id,
        modelId: model.modelId,
        kind: model.kind,
        enabled: model.enabled === 1,
        isDefault: model.isDefault === 1,
        sortOrder: model.sortOrder,
      });
      modelsByChannel.set(model.channelId, list);
    }
    return channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      baseUrl: channel.baseUrl,
      apiKeyHint: maskKey(resolveModelChannelKey(channel)),
      enabled: channel.enabled === 1,
      sortOrder: channel.sortOrder,
      models: modelsByChannel.get(channel.id) ?? [],
    }));
  } catch (error) {
    if (!isMissingRelation(error)) {
      console.warn("读取模型渠道列表失败:", error);
    }
    return [];
  }
}

export function listLegacyModelIds(
  config: LegacyConfigShape,
  kind: ModelChannelKind,
): string[] {
  const configured = kind === "image" ? config.enabledImageModels : config.enabledTextModels;
  const fallback = kind === "image" ? config.imageModel : config.textModel;
  return [
    ...new Set(
      [
        ...parseLegacyModelIds(configured),
        fallback?.trim() || "",
      ].filter(Boolean),
    ),
  ];
}

export async function listConfiguredModelIds(
  config: LegacyConfigShape,
  kind: ModelChannelKind,
): Promise<string[]> {
  const bindings = await listChannelBindings();
  const channelIds = listDefaultModelIds(bindings, kind);
  return channelIds.length > 0 ? channelIds : listLegacyModelIds(config, kind);
}

export async function isConfiguredModelEnabled(
  config: LegacyConfigShape,
  kind: ModelChannelKind,
  modelId: string,
): Promise<boolean> {
  return (await listConfiguredModelIds(config, kind)).includes(modelId);
}

export async function resolveConfiguredEndpoint(
  kind: ConfiguredEndpointKind,
  model: string,
  config: LegacyConfigShape,
): Promise<UpstreamEndpoint> {
  const bindings = await listChannelBindings();
  const bindingKind: ModelChannelKind = kind === "vision" ? "text" : kind;
  const binding = selectDefaultBinding(bindings, bindingKind, model);

  if (!binding) {
    if (kind === "image") return resolveImageEndpoint(model, config);
    if (kind === "vision") return resolveVisionEndpoint(model, config);
    return resolveChatEndpoint(model, config);
  }

  const retryPolicyEndpoint =
    kind === "image"
      ? resolveImageEndpoint(model, config)
      : kind === "vision"
        ? resolveVisionEndpoint(model, config)
        : resolveChatEndpoint(model, config);

  return {
    // A configured channel is authoritative. Never borrow the legacy key or
    // base URL, otherwise a new channel could silently use another channel's
    // credential and make failures look like automatic failover.
    apiKey: binding.apiKey.trim(),
    baseUrl: normalizeBaseUrl(binding.baseUrl),
    maxRetries: retryPolicyEndpoint.maxRetries,
  };
}

function isUuid(value: string | undefined): value is string {
  return !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
}

export async function replaceModelChannels(
  input: ChannelPayloadInput[],
): Promise<void> {
  const channels = normalizeChannelPayload(input);

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(llmChannels);
    const existingById = new Map(existing.map((channel) => [channel.id, channel]));
    const retainedIds: string[] = [];
    const channelIds = new Map<number, string>();

    for (let index = 0; index < channels.length; index++) {
      const channel = channels[index];
      const previous = isUuid(channel.id)
        ? existingById.get(channel.id)
        : undefined;
      const suppliedKey = channel.apiKey?.trim();
      const encryptedKey = suppliedKey
        ? encryptModelChannelKey(suppliedKey)
        : previous
          ? {
              plaintext: previous.apiKey,
              ciphertext: previous.apiKeyCiphertext,
              iv: previous.apiKeyIv,
              authTag: previous.apiKeyAuthTag,
            }
          : encryptModelChannelKey("");
      let channelId = previous?.id;

      if (channelId) {
        await tx
          .update(llmChannels)
          .set({
            name: channel.name,
            baseUrl: channel.baseUrl,
            apiKey: encryptedKey.plaintext,
            apiKeyCiphertext: encryptedKey.ciphertext,
            apiKeyIv: encryptedKey.iv,
            apiKeyAuthTag: encryptedKey.authTag,
            enabled: channel.enabled === false ? 0 : 1,
            sortOrder: channel.sortOrder ?? index,
            updatedAt: new Date(),
          })
          .where(eq(llmChannels.id, channelId));
      } else {
        const [created] = await tx
          .insert(llmChannels)
          .values({
            name: channel.name,
            baseUrl: channel.baseUrl,
            apiKey: encryptedKey.plaintext,
            apiKeyCiphertext: encryptedKey.ciphertext,
            apiKeyIv: encryptedKey.iv,
            apiKeyAuthTag: encryptedKey.authTag,
            enabled: channel.enabled === false ? 0 : 1,
            sortOrder: channel.sortOrder ?? index,
            updatedAt: new Date(),
          })
          .returning({ id: llmChannels.id });
        channelId = created.id;
      }

      retainedIds.push(channelId);
      channelIds.set(index, channelId);
    }

    // 渠道模型没有外部引用，统一在事务内重建，保证默认绑定不会残留。
    await tx.delete(llmChannelModels);
    for (const previous of existing) {
      if (!retainedIds.includes(previous.id)) {
        await tx.delete(llmChannels).where(eq(llmChannels.id, previous.id));
      }
    }

    const modelRows = channels.flatMap((channel, channelIndex) =>
      channel.models.map((model, modelIndex) => ({
        channelId: channelIds.get(channelIndex)!,
        modelId: model.modelId,
        kind: model.kind,
        enabled: model.enabled === false ? 0 : 1,
        isDefault: model.isDefault === true ? 1 : 0,
        sortOrder: model.sortOrder ?? modelIndex,
      })),
    );
    if (modelRows.length > 0) {
      await tx.insert(llmChannelModels).values(modelRows);
    }
  });
}
