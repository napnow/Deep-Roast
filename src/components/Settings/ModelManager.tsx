"use client";

import { useMemo, useState } from "react";
import { apiJson } from "@/lib/client-api";

interface ModelManagerProps {
  kind: "text" | "image";
  enabled: string[];
  onChange: (ids: string[]) => void;
  defaultModel: string;
  onDefaultModelChange: (id: string) => void;
  /** 设置页当前填写的 Base URL（未保存也生效） */
  baseUrl: string;
  /** 设置页当前填写的 API Key；空则服务端用已保存 key */
  apiKey: string;
  hasSavedApiKey?: boolean;
}

export default function ModelManager({
  kind,
  enabled,
  onChange,
  defaultModel,
  onDefaultModelChange,
  baseUrl,
  apiKey,
  hasSavedApiKey,
}: ModelManagerProps) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [sourceHint, setSourceHint] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [customId, setCustomId] = useState("");
  const [filter, setFilter] = useState("");

  const title = kind === "text" ? "文生文模型" : "文生图模型";
  const enabledSet = useMemo(() => new Set(enabled), [enabled]);

  const filteredCatalog = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return catalog.filter((id) => {
      if (enabledSet.has(id)) return false;
      if (!q) return true;
      return id.toLowerCase().includes(q);
    });
  }, [catalog, enabledSet, filter]);

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
      // 只有用户在表单里新输入了 key 才传；否则服务端用已保存的
      if (apiKey.trim()) body.apiKey = apiKey.trim();

      const data = await apiJson<{
        textModels?: { id: string }[];
        imageModels?: { id: string }[];
        warning?: string;
        baseUrl?: string;
        upstreamCount?: number;
        source?: string;
      }>("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const list =
        kind === "text"
          ? (data.textModels || []).map((m) => m.id)
          : (data.imageModels || []).map((m) => m.id);
      setCatalog(list);
      setPicked(new Set());
      if (data.warning) setWarning(data.warning);
      setSourceHint(
        `来自 ${data.baseUrl || baseUrl.trim()}（上游 ${data.upstreamCount ?? 0} 个）`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "获取模型失败");
      setCatalog([]);
    }
    setLoading(false);
  }

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPicked() {
    if (picked.size === 0) return;
    const merged = [...enabled];
    for (const id of picked) {
      if (!merged.includes(id)) merged.push(id);
    }
    onChange(merged);
    setPicked(new Set());
  }

  function addCustom() {
    const id = customId.trim();
    if (!id) return;
    if (!enabled.includes(id)) onChange([...enabled, id]);
    if (catalog.length && !catalog.includes(id)) {
      setCatalog((prev) => [id, ...prev]);
    }
    setCustomId("");
  }

  function removeOne(id: string) {
    if (enabled.length <= 1) return;
    const next = enabled.filter((x) => x !== id);
    onChange(next);
    if (defaultModel === id && next[0]) {
      onDefaultModelChange(next[0]);
    }
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
        <div>
          <div
            className="text-[11px] font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            {title}管理
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            使用上方当前填写的 Base URL + API Key 拉取（无需先保存）
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

      {sourceHint && (
        <p className="text-[10px]" style={{ color: "var(--accent)" }}>
          {sourceHint}
        </p>
      )}

      {/* 已启用 */}
      <div className="space-y-1.5">
        <div
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          已启用（{enabled.length}）
        </div>
        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
          {enabled.map((id) => (
            <div
              key={id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                title="设为默认"
                onClick={() => onDefaultModelChange(id)}
                className="w-3.5 h-3.5 rounded-full shrink-0 border"
                style={{
                  borderColor:
                    id === defaultModel ? "var(--accent)" : "var(--border)",
                  background:
                    id === defaultModel ? "var(--accent)" : "transparent",
                }}
              />
              <span
                className="flex-1 truncate font-mono text-[11px]"
                style={{
                  color:
                    id === defaultModel
                      ? "var(--accent)"
                      : "var(--text-secondary)",
                }}
                title={id}
              >
                {id}
              </span>
              {id === defaultModel && (
                <span
                  className="text-[9px] shrink-0"
                  style={{ color: "var(--accent)" }}
                >
                  默认
                </span>
              )}
              <button
                type="button"
                onClick={() => removeOne(id)}
                disabled={enabled.length <= 1}
                title={
                  enabled.length <= 1 ? "至少保留一个" : "从启用列表移除"
                }
                className="text-[11px] px-1.5 py-0.5 rounded disabled:opacity-30 hover:opacity-80"
                style={{ color: "var(--danger)" }}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 手动添加 */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={customId}
          onChange={(e) => setCustomId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="手动输入模型 id…"
          className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-mono"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={addCustom}
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          添加
        </button>
      </div>

      {/* 目录勾选 */}
      {catalog.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              可选目录（未启用 {filteredCatalog.length}）
            </div>
            <button
              type="button"
              onClick={addPicked}
              disabled={picked.size === 0}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold disabled:opacity-40"
              style={{
                background: "var(--accent-surface)",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
              }}
            >
              添加所选（{picked.size}）
            </button>
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
            className="max-h-40 overflow-y-auto rounded-lg border divide-y"
            style={{ borderColor: "var(--border)" }}
          >
            {filteredCatalog.length === 0 ? (
              <div
                className="px-2 py-3 text-[11px] text-center"
                style={{ color: "var(--text-muted)" }}
              >
                没有可添加的模型（或已全部启用）
              </div>
            ) : (
              filteredCatalog.map((id) => (
                <label
                  key={id}
                  className="flex items-center gap-2 px-2 py-1.5 text-[11px] cursor-pointer hover:opacity-90"
                  style={{ background: "var(--bg-surface)" }}
                >
                  <input
                    type="checkbox"
                    checked={picked.has(id)}
                    onChange={() => togglePick(id)}
                  />
                  <span
                    className="font-mono truncate"
                    style={{ color: "var(--text-secondary)" }}
                    title={id}
                  >
                    {id}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
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
