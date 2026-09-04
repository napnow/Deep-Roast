"use client";

import { useState } from "react";
import { apiJson } from "@/lib/client-api";
import type { Config, ModelChannel, ModelChannelKind } from "@/types";

export interface ChannelDraftModel {
  id?: string;
  modelId: string;
  kind: ModelChannelKind;
  enabled: boolean;
  isDefault: boolean;
  sortOrder?: number;
}

export interface ChannelDraft {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeyHint: string;
  enabled: boolean;
  sortOrder: number;
  models: ChannelDraftModel[];
}

export function createChannelDrafts(config: Config): ChannelDraft[] {
  if (config.channels?.length) {
    return config.channels.map((channel) => ({
      ...channel,
      apiKey: "",
      models: channel.models.map((model) => ({ ...model })),
    }));
  }

  const textModels = config.enabledTextModels?.length
    ? config.enabledTextModels
    : config.textModel
      ? [config.textModel]
      : [];
  const imageModels = config.enabledImageModels?.length
    ? config.enabledImageModels
    : config.imageModel
      ? [config.imageModel]
      : [];
  const models = [
    ...textModels.map((modelId, sortOrder) => ({
      modelId,
      kind: "text" as const,
      enabled: true,
      isDefault: modelId === config.textModel,
      sortOrder,
    })),
    ...imageModels.map((modelId, sortOrder) => ({
      modelId,
      kind: "image" as const,
      enabled: true,
      isDefault: modelId === config.imageModel,
      sortOrder,
    })),
  ];

  return [
    {
      id: "legacy-default",
      name: "现有默认渠道",
      baseUrl: config.baseUrl,
      apiKey: "",
      apiKeyHint: config.apiKeyHint || "",
      enabled: true,
      sortOrder: 0,
      models,
    },
  ];
}

export function setDefaultChannelModel(
  channels: ChannelDraft[],
  channelId: string,
  kind: ModelChannelKind,
  modelId: string,
): ChannelDraft[] {
  return channels.map((channel) => ({
    ...channel,
    models: channel.models.map((model) =>
      model.kind === kind && model.modelId === modelId
        ? {
            ...model,
            enabled: channel.id === channelId ? true : model.enabled,
            isDefault: channel.id === channelId,
          }
        : model,
    ),
  }));
}

interface ChannelManagerProps {
  value: ChannelDraft[];
  onChange: (channels: ChannelDraft[]) => void;
}

const inputStyle = {
  background: "var(--bg-root)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
} as const;

export default function ChannelManager({
  value,
  onChange,
}: ChannelManagerProps) {
  const [catalog, setCatalog] = useState<Record<string, string[]>>({});
  const [catalogLoading, setCatalogLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [manualIds, setManualIds] = useState<Record<string, string>>({});
  const [manualKinds, setManualKinds] = useState<
    Record<string, ModelChannelKind>
  >({});

  function updateChannel(channelId: string | undefined, patch: Partial<ChannelDraft>) {
    onChange(
      value.map((channel) =>
        channel.id === channelId ? { ...channel, ...patch } : channel,
      ),
    );
  }

  function addChannel() {
    const id = `new-${Date.now()}`;
    onChange([
      ...value,
      {
        id,
        name: `新渠道 ${value.length + 1}`,
        baseUrl: "",
        apiKey: "",
        apiKeyHint: "",
        enabled: true,
        sortOrder: value.length,
        models: [],
      },
    ]);
  }

  function removeChannel(channelId: string | undefined) {
    if (value.length <= 1) return;
    onChange(value.filter((channel) => channel.id !== channelId));
  }

  function addModel(channelId: string | undefined, modelId: string, kind: ModelChannelKind) {
    const normalized = modelId.trim();
    if (!normalized) return;
    const channel = value.find((item) => item.id === channelId);
    if (!channel || channel.models.some((model) => model.kind === kind && model.modelId === normalized)) {
      return;
    }
    const hasDefault = value.some((item) =>
      item.models.some(
        (model) => model.kind === kind && model.modelId === normalized && model.isDefault,
      ),
    );
    updateChannel(channelId, {
      models: [
        ...channel.models,
        {
          modelId: normalized,
          kind,
          enabled: true,
          isDefault: !hasDefault,
          sortOrder: channel.models.length,
        },
      ],
    });
    if (channelId) setManualIds((previous) => ({ ...previous, [channelId]: "" }));
  }

  function removeModel(channelId: string | undefined, modelId: string, kind: ModelChannelKind) {
    const channel = value.find((item) => item.id === channelId);
    if (!channel) return;
    updateChannel(channelId, {
      models: channel.models.filter(
        (model) => !(model.modelId === modelId && model.kind === kind),
      ),
    });
  }

  function toggleModel(channelId: string | undefined, modelId: string, kind: ModelChannelKind) {
    const channel = value.find((item) => item.id === channelId);
    if (!channel) return;
    updateChannel(channelId, {
      models: channel.models.map((model) =>
        model.modelId === modelId && model.kind === kind
          ? { ...model, enabled: !model.enabled }
          : model,
      ),
    });
  }

  async function fetchCatalog(channel: ChannelDraft) {
    if (!channel.baseUrl.trim()) {
      setErrors((previous) => ({ ...previous, [channel.id || ""]: "请先填写 Base URL" }));
      return;
    }
    if (!channel.apiKey.trim()) {
      setErrors((previous) => ({
        ...previous,
        [channel.id || ""]: "获取目录时请重新输入该渠道 Key",
      }));
      return;
    }
    setCatalogLoading(channel.id || "");
    setErrors((previous) => ({ ...previous, [channel.id || ""]: "" }));
    try {
      const data = await apiJson<{
        textModels?: { id: string }[];
        imageModels?: { id: string }[];
      }>("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: channel.baseUrl,
          apiKey: channel.apiKey,
        }),
      });
      const ids = [
        ...(data.textModels || []).map((model) => model.id),
        ...(data.imageModels || []).map((model) => model.id),
      ];
      setCatalog((previous) => ({ ...previous, [channel.id || ""]: [...new Set(ids)] }));
    } catch (error: unknown) {
      setErrors((previous) => ({
        ...previous,
        [channel.id || ""]: error instanceof Error ? error.message : "获取模型失败",
      }));
    } finally {
      setCatalogLoading(null);
    }
  }

  return (
    <div
      className="space-y-3 rounded-xl border p-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-root)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
            模型渠道
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            同一个模型可以配置多个渠道，但只有管理员指定的默认渠道会被调用
          </div>
        </div>
        <button
          type="button"
          onClick={addChannel}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
          style={{
            background: "var(--accent-surface)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          + 添加渠道
        </button>
      </div>

      {value.map((channel, channelIndex) => {
        const channelId = channel.id || `channel-${channelIndex}`;
        const channelCatalog = catalog[channelId] || [];
        const manualKind = manualKinds[channelId] || "image";
        return (
          <div
            key={channelId}
            className="space-y-2 rounded-xl border p-3"
            style={{ borderColor: "var(--border-strong)", background: "var(--bg-surface)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <input
                  value={channel.name}
                  onChange={(event) => updateChannel(channel.id, { name: event.target.value })}
                  className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                  style={inputStyle}
                  aria-label={`渠道 ${channelIndex + 1} 名称`}
                />
                <label className="flex shrink-0 items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={channel.enabled}
                    onChange={() => updateChannel(channel.id, { enabled: !channel.enabled })}
                  />
                  启用
                </label>
              </div>
              <button
                type="button"
                onClick={() => removeChannel(channel.id)}
                disabled={value.length <= 1}
                className="shrink-0 text-[10px] disabled:opacity-30"
                style={{ color: "var(--danger)" }}
              >
                删除
              </button>
            </div>

            <input
              value={channel.baseUrl}
              onChange={(event) => updateChannel(channel.id, { baseUrl: event.target.value })}
              placeholder="https://example.com/v1"
              className="w-full rounded-lg px-2.5 py-1.5 text-[11px]"
              style={inputStyle}
              aria-label={`${channel.name} Base URL`}
            />
            <input
              type="password"
              value={channel.apiKey}
              onChange={(event) => updateChannel(channel.id, { apiKey: event.target.value })}
              placeholder={channel.apiKeyHint ? `已配置 ${channel.apiKeyHint}，留空不修改` : "输入该渠道 API Key"}
              autoComplete="off"
              className="w-full rounded-lg px-2.5 py-1.5 text-[11px]"
              style={inputStyle}
              aria-label={`${channel.name} API Key`}
            />

            <div className="flex items-center gap-1.5">
              <select
                value={manualKind}
                onChange={(event) =>
                  setManualKinds((previous) => ({
                    ...previous,
                    [channelId]: event.target.value as ModelChannelKind,
                  }))
                }
                className="rounded-lg px-2 py-1.5 text-[11px]"
                style={inputStyle}
                aria-label={`${channel.name} 模型类型`}
              >
                <option value="image">生图</option>
                <option value="text">对话</option>
              </select>
              <input
                value={manualIds[channelId] || ""}
                onChange={(event) =>
                  setManualIds((previous) => ({ ...previous, [channelId]: event.target.value }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addModel(channel.id, manualIds[channelId] || "", manualKind);
                  }
                }}
                placeholder="手动添加模型 ID"
                className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-mono"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => addModel(channel.id, manualIds[channelId] || "", manualKind)}
                className="shrink-0 rounded-lg px-2 py-1.5 text-[11px]"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                添加
              </button>
              <button
                type="button"
                onClick={() => fetchCatalog(channel)}
                disabled={catalogLoading === channelId}
                className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] disabled:opacity-50"
                style={{ background: "var(--accent-surface)", border: "1px solid var(--accent)", color: "var(--accent)" }}
              >
                {catalogLoading === channelId ? "获取中…" : "获取目录"}
              </button>
            </div>

            {errors[channelId] ? (
              <p className="text-[10px]" style={{ color: "var(--danger)" }}>
                {errors[channelId]}
              </p>
            ) : null}

            {channel.models.length > 0 ? (
              <div className="space-y-1">
                {channel.models.map((model) => (
                  <div
                    key={`${model.kind}:${model.modelId}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px]"
                    style={{ background: "var(--bg-root)", border: "1px solid var(--border)" }}
                  >
                    <span className="shrink-0 rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[9px]" style={{ color: "var(--text-muted)" }}>
                      {model.kind === "image" ? "生图" : "对话"}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono" title={model.modelId} style={{ color: "var(--text-secondary)" }}>
                      {model.modelId}
                    </span>
                    <label className="flex shrink-0 items-center gap-1 text-[9px]" style={{ color: "var(--text-muted)" }}>
                      <input
                        type="checkbox"
                        checked={model.enabled}
                        onChange={() => toggleModel(channel.id, model.modelId, model.kind)}
                      />
                      启用
                    </label>
                    {model.isDefault ? (
                      <span className="shrink-0 text-[9px] font-semibold" style={{ color: "var(--accent)" }}>
                        默认
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onChange(setDefaultChannelModel(value, channel.id || "", model.kind, model.modelId))}
                        className="shrink-0 text-[9px]"
                        style={{ color: "var(--accent)" }}
                      >
                        设为默认
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeModel(channel.id, model.modelId, model.kind)}
                      className="shrink-0 text-[9px]"
                      style={{ color: "var(--danger)" }}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed px-2 py-2 text-center text-[10px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                尚未添加模型；可以手动输入模型 ID
              </p>
            )}

            {channelCatalog.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 border-t pt-2" style={{ borderColor: "var(--border)" }}>
                {channelCatalog.map((modelId) => (
                  <button
                    key={modelId}
                    type="button"
                    onClick={() => addModel(channel.id, modelId, manualKind)}
                    className="rounded-full px-2 py-1 text-[10px]"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  >
                    + {modelId}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export type { ModelChannel };
