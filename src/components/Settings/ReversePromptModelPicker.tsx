"use client";

import { useMemo, useState } from "react";
import { apiJson } from "@/lib/client-api";

interface ReversePromptModelPickerProps {
  value: string;
  onChange: (id: string) => void;
  baseUrl: string;
  apiKey: string;
  hasSavedApiKey?: boolean;
}

/**
 * 图推模型：与文/图 ModelManager 相同，用当前 Base URL + Key 从上游 /models 拉取，
 * 再点选一条作为反推/图生图分析模型（单选，非启用列表）。
 */
export default function ReversePromptModelPicker({
  value,
  onChange,
  baseUrl,
  apiKey,
  hasSavedApiKey,
}: ReversePromptModelPickerProps) {
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
    if (!baseUrl.trim()) {
      setError("请先在上方填写 API Base URL");
      return;
    }
    if (!apiKey.trim() && !hasSavedApiKey) {
      setError("请先在上方填写 API Key");
      return;
    }

    setLoading(true);
    setError("");
    setWarning("");
    setSourceHint("");
    try {
      const body: { baseUrl: string; apiKey?: string } = {
        baseUrl: baseUrl.trim(),
      };
      if (apiKey.trim()) body.apiKey = apiKey.trim();

      const data = await apiJson<{
        textModels?: { id: string }[];
        imageModels?: { id: string }[];
        warning?: string;
        baseUrl?: string;
        upstreamCount?: number;
      }>("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // 图推走 chat+vision：优先文本/多模态目录；把当前值钉在列表前
      const ids = [
        ...new Set([
          ...(data.textModels || []).map((m) => m.id),
          // 少数网关把 gemini 等放进未分类，text 已含兜底
        ]),
      ].filter(Boolean);

      if (value?.trim() && !ids.includes(value.trim())) {
        ids.unshift(value.trim());
      }

      setCatalog(ids);
      if (data.warning) setWarning(data.warning);
      setSourceHint(
        `来自 ${data.baseUrl || baseUrl.trim()}（上游 ${data.upstreamCount ?? 0} 个 · 文本/多模态）`,
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
    <div
      className="rounded-xl border p-3 space-y-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-root)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            图推模型
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            反推提示词 / 图生图分析 · 需支持图文输入 · 与上方同一套 Base URL + Key
          </div>
        </div>
        <button
          type="button"
          onClick={fetchCatalog}
          disabled={loading}
          className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:scale-105 disabled:opacity-50"
          style={{
            background: "var(--accent-surface)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          {loading ? "获取中…" : "获取模型"}
        </button>
      </div>

      {/* 当前选中 */}
      <div
        className="rounded-lg px-2.5 py-2 text-[11px] font-mono flex items-center gap-2"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          color: value?.trim() ? "var(--accent)" : "var(--text-muted)",
        }}
      >
        <span
          className="text-[9px] font-sans font-bold tracking-wide shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          当前
        </span>
        <span
          className="truncate"
          title={value?.trim() || "未设置（运行时用文生文模型）"}
        >
          {value?.trim() || "未设置 · 将用文生文模型"}
        </span>
        {value?.trim() && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-auto shrink-0 text-[9px] font-sans px-1.5 py-0.5 rounded"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
            title="清除，改用文生文模型"
          >
            清除
          </button>
        )}
      </div>

      {sourceHint && (
        <p className="text-[10px]" style={{ color: "var(--accent)" }}>
          {sourceHint}
        </p>
      )}

      {/* 手动输入 */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={customId}
          onChange={(e) => setCustomId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyCustom();
            }
          }}
          placeholder="手动输入视觉模型 id…"
          className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-mono"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={applyCustom}
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          选用
        </button>
      </div>

      {/* 目录单选 */}
      {catalog.length > 0 && (
        <div className="space-y-1.5">
          <div
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            从上游选择（{filteredCatalog.length}）
          </div>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="筛选模型 id…"
            className="w-full rounded-lg px-2.5 py-1.5 text-[11px]"
            style={inputStyle}
          />
          <div
            className="max-h-44 overflow-y-auto rounded-lg border divide-y"
            style={{ borderColor: "var(--border)" }}
          >
            {filteredCatalog.length === 0 ? (
              <div
                className="px-2 py-3 text-[11px] text-center"
                style={{ color: "var(--text-muted)" }}
              >
                没有匹配的模型
              </div>
            ) : (
              filteredCatalog.map((id) => {
                const selected = id === value;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange(id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[11px] transition-colors hover:opacity-90"
                    style={{
                      background: selected
                        ? "var(--accent-surface)"
                        : "var(--bg-surface)",
                    }}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border"
                      style={{
                        borderColor: selected
                          ? "var(--accent)"
                          : "var(--border)",
                        background: selected ? "var(--accent)" : "transparent",
                      }}
                    />
                    <span
                      className="font-mono truncate"
                      style={{
                        color: selected
                          ? "var(--accent)"
                          : "var(--text-secondary)",
                      }}
                      title={id}
                    >
                      {id}
                    </span>
                    {selected && (
                      <span
                        className="ml-auto text-[9px] shrink-0 font-sans"
                        style={{ color: "var(--accent)" }}
                      >
                        已选
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {catalog.length === 0 && !loading && !error && (
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          点击「获取模型」从 API 拉取可选目录，或手动输入模型 id。
        </p>
      )}

      {warning && (
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {warning}
        </p>
      )}
      {error && (
        <p className="text-[10px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
