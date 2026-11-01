"use client";

import { useMemo, useState } from "react";
import { apiJson } from "@/lib/client-api";
import { decideModelCatalogRequest } from "./model-manager-request";

interface PromptModelPickerProps {
  label: string;
  description: string;
  fallbackLabel: string;
  placeholder: string;
  value: string;
  onChange: (id: string) => void;
  baseUrl: string;
  savedBaseUrl: string;
  apiKey: string;
  hasSavedApiKey?: boolean;
}

/**
 * Shared single-model picker for prompt tasks that use a text model.
 * It intentionally reuses the same credential-safe catalog request as the
 * reverse-prompt picker so unsaved Base URL/key values work consistently.
 */
export default function PromptModelPicker({
  label,
  description,
  fallbackLabel,
  placeholder,
  value,
  onChange,
  baseUrl,
  savedBaseUrl,
  apiKey,
  hasSavedApiKey,
}: PromptModelPickerProps) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [sourceHint, setSourceHint] = useState("");
  const [filter, setFilter] = useState("");
  const [customId, setCustomId] = useState("");

  const filteredCatalog = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((id) => id.toLowerCase().includes(q));
  }, [catalog, filter]);

  async function fetchCatalog() {
    const decision = decideModelCatalogRequest({
      baseUrl,
      savedBaseUrl,
      apiKey,
      hasSavedApiKey: !!hasSavedApiKey,
    });
    if (decision.kind === "error") {
      setError(decision.message);
      return;
    }

    setLoading(true);
    setError("");
    setWarning("");
    setSourceHint("");
    try {
      const data = await apiJson<{
        textModels?: { id: string }[];
        warning?: string;
        baseUrl?: string;
        upstreamCount?: number;
      }>(
        "/api/models",
        decision.method === "GET"
          ? { method: "GET" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(decision.body),
            },
      );
      const ids = [...new Set((data.textModels || []).map((m) => m.id))]
        .filter(Boolean);
      if (value.trim() && !ids.includes(value.trim())) ids.unshift(value.trim());
      setCatalog(ids);
      if (data.warning) setWarning(data.warning);
      setSourceHint(
        `来自 ${data.baseUrl || baseUrl.trim()}（上游 ${data.upstreamCount ?? 0} 个 · 文本模型）`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取模型失败");
      setCatalog([]);
    }
    setLoading(false);
  }

  function applyCustom() {
    const id = customId.trim();
    if (!id) return;
    onChange(id);
    if (!catalog.includes(id)) setCatalog((prev) => [id, ...prev]);
    setCustomId("");
  }

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  } as const;

  return (
    <div className="settings-model-card">
      <div className="settings-model-card__header">
        <div className="min-w-0">
          <div className="settings-model-card__eyebrow">{label}</div>
          <div className="settings-model-card__description">
            {description}
          </div>
        </div>
        <button
          type="button"
          onClick={fetchCatalog}
          disabled={loading}
          className="settings-model-fetch"
        >
          {loading ? "获取中…" : "获取模型"}
        </button>
      </div>

      <div className="settings-model-current">
        <span className="settings-model-current__label">当前</span>
        <span className="settings-model-current__value" title={value.trim()}>
          {value.trim() || fallbackLabel}
        </span>
        {value.trim() ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="settings-model-current__clear"
            title={fallbackLabel}
          >
            清除
          </button>
        ) : null}
      </div>

      {sourceHint ? (
        <p className="settings-model-hint">{sourceHint}</p>
      ) : null}

      <div className="flex gap-1.5">
        <input
          type="text"
          value={customId}
          onChange={(event) => setCustomId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyCustom();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-mono"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={applyCustom}
          className="settings-model-secondary"
        >
          选用
        </button>
      </div>

      {catalog.length > 0 ? (
        <div className="space-y-1.5">
          <div className="settings-model-catalog-title">
            从上游选择（{filteredCatalog.length}）
          </div>
          <input
            type="text"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="筛选模型 id…"
            className="w-full rounded-lg px-2.5 py-1.5 text-[11px]"
            style={inputStyle}
          />
          <div className="settings-model-catalog">
            {filteredCatalog.length === 0 ? (
              <div className="settings-model-empty">没有匹配的模型</div>
            ) : (
              filteredCatalog.map((id) => {
                const selected = id === value;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange(id)}
                    className="settings-model-option"
                    aria-pressed={selected}
                  >
                    <span
                      className="settings-model-option__dot"
                      data-selected={selected}
                    />
                    <span
                      className="font-mono truncate"
                      title={id}
                    >
                      {id}
                    </span>
                    {selected ? (
                      <span className="settings-model-option__selected">
                        已选
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {catalog.length === 0 && !loading && !error ? (
        <p className="settings-model-hint">
          点击「获取模型」从 API 拉取目录，或手动输入模型 id。
        </p>
      ) : null}

      {warning ? <p className="settings-model-hint">{warning}</p> : null}
      {error ? <p className="settings-model-error">{error}</p> : null}
    </div>
  );
}
