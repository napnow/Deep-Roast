"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";

type ImageCostMap = Record<string, number>;

export default function AdminImageCostsCard() {
  const [costs, setCosts] = useState<ImageCostMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ imageModelCosts?: ImageCostMap }>(
        "/api/admin/image-costs",
      );
      setCosts(data.imageModelCosts || {});
      setMessage("");
    } catch (error: unknown) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "配置加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invalid = useMemo(
    () =>
      Object.entries(costs).some(
        ([modelId, cost]) =>
          !modelId.trim() || !Number.isSafeInteger(cost) || cost < 1,
      ),
    [costs],
  );

  function updateCost(modelId: string, value: string) {
    setCosts((current) => ({
      ...current,
      [modelId]: value === "" ? Number.NaN : Number(value),
    }));
    setMessage("");
  }

  async function save() {
    if (saving || invalid) return;
    setSaving(true);
    setMessage("");
    try {
      const data = await apiJson<{ imageModelCosts?: ImageCostMap }>(
        "/api/admin/image-costs",
        {
          method: "PUT",
          ...jsonBody({ imageModelCosts: costs }),
        },
      );
      setCosts(data.imageModelCosts || costs);
      setMessageTone("success");
      setMessage("已保存，新的请求将使用最新费用");
    } catch (error: unknown) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <p className="admin-kicker">Credit Policy</p>
          <h2 className="admin-title text-lg mt-1">生图计费配置</h2>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            设置每个生图模型生成一张图片所消耗的积分。未配置或读取异常时默认 5 积分。
          </p>
        </div>
        <span
          className="text-[11px] tabular-nums px-2 py-0.5 rounded-full"
          style={{
            background: "var(--bg-root)",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          {Object.keys(costs).length} 个模型
        </span>
      </div>

      <div className="admin-card-body space-y-4">
        <div
          className="rounded-[var(--radius)] px-3 py-2.5 text-[11px] leading-relaxed"
          style={{
            background: "var(--accent-surface)",
            color: "var(--text-secondary)",
            border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
          }}
        >
          只显示当前启用的生图模型；修改不会影响历史积分流水，管理员生图仍然免费。
        </div>

        {message ? (
          <p
            role="status"
            className="text-xs"
            style={{
              color: messageTone === "error" ? "var(--danger)" : "var(--success)",
            }}
          >
            {message}
          </p>
        ) : null}

        {loading ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            正在读取模型费用…
          </p>
        ) : Object.keys(costs).length === 0 ? (
          <div
            className="rounded-[var(--radius)] px-3 py-6 text-center text-xs"
            style={{
              background: "var(--bg-root)",
              color: "var(--text-muted)",
              border: "1px dashed var(--border-strong)",
            }}
          >
            暂无启用的生图模型
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(costs).map(([modelId, cost]) => (
              <label
                key={modelId}
                className="flex flex-col gap-2 rounded-[var(--radius)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                style={{
                  background: "var(--bg-root)",
                  border: "1px solid var(--border)",
                }}
              >
                <span className="min-w-0 truncate text-xs font-medium" title={modelId}>
                  {modelId}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={Number.isNaN(cost) ? "" : cost}
                    onChange={(event) => updateCost(modelId, event.target.value)}
                    aria-label={`${modelId} 每张图片积分`}
                    className="admin-input w-28 text-right tabular-nums"
                  />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    积分/张
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="admin-btn admin-btn--ghost"
          >
            重新读取
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading || saving || invalid || Object.keys(costs).length === 0}
            className="admin-btn admin-btn--solid"
          >
            {saving ? "保存中…" : "保存计费配置"}
          </button>
        </div>
      </div>
    </section>
  );
}
