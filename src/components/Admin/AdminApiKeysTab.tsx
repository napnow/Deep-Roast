"use client";

import { useEffect, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";
import { apiKeyStatusLabel } from "@/lib/api-key-ui";
import { AppIcon } from "@/components/ui/icons";

interface KeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  status: "active" | "disabled";
  usageCount: number;
  creditsConsumed: number;
  lastUsedAt: string | null;
  createdAt: string | null;
}

export default function AdminApiKeysTab({ userId }: { userId: string }) {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiJson<{ keys: KeyRecord[] }>(`/api/admin/users/${userId}/api-keys`)
      .then((data) => { if (active) setKeys(data.keys || []); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "加载失败"); });
    return () => { active = false; };
  }, [userId]);

  async function createKey() {
    if (!name.trim() || busy) return;
    setBusy("create");
    setError("");
    try {
      const data = await apiJson<{ record: KeyRecord }>(
        `/api/admin/users/${userId}/api-keys`,
        { method: "POST", ...jsonBody({ name }) },
      );
      setKeys((rows) => [data.record, ...rows]);
      setName("");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "创建失败");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(key: KeyRecord) {
    setBusy(key.id);
    try {
      const updated = await apiJson<KeyRecord>(
        `/api/admin/users/${userId}/api-keys/${key.id}`,
        {
          method: "PATCH",
          ...jsonBody({ status: key.status === "active" ? "disabled" : "active" }),
        },
      );
      setKeys((rows) => rows.map((row) => row.id === updated.id ? updated : row));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "更新失败");
    } finally {
      setBusy(null);
    }
  }

  async function remove(key: KeyRecord) {
    if (!window.confirm(`确认删除 Key「${key.name || key.keyPrefix}」？`)) return;
    setBusy(key.id);
    try {
      await apiJson(`/api/admin/users/${userId}/api-keys/${key.id}`, { method: "DELETE" });
      setKeys((rows) => rows.filter((row) => row.id !== key.id));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "删除失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-body space-y-4">
        <div>
          <p className="admin-kicker">API Access</p>
          <h2 className="admin-title text-xl mt-1">用户 API Key</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            可创建、停用或删除该用户的中转密钥；完整 Key 仅用户本人可查看和复制。
          </p>
        </div>
        <div className="flex gap-2">
          <input className="ui-field flex-1 px-3" value={name} onChange={(event) => setName(event.target.value)} placeholder="Key 名称" />
          <button className="ui-button ui-button--primary" disabled={!name.trim() || busy !== null} onClick={createKey}>
            <AppIcon name="key" />{busy === "create" ? "创建中…" : "创建 Key"}
          </button>
        </div>
        {error ? <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p> : null}
        <div className="admin-key-list">
          {keys.length === 0 ? <p className="asset-empty">该用户暂无 API Key</p> : keys.map((key) => (
            <article key={key.id} className="admin-key-row">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{key.name || "未命名 Key"}</p>
                <p className="font-mono text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{key.keyPrefix}…</p>
              </div>
              <div className="admin-key-metrics">
                <span>{apiKeyStatusLabel(key.status)}</span>
                <span>{key.usageCount} 次请求</span>
                <span>{key.creditsConsumed} 积分</span>
                <span>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("zh-CN") : "未使用"}</span>
              </div>
              <div className="flex gap-2">
                <button className="ui-button" disabled={busy === key.id} onClick={() => toggle(key)}>{key.status === "active" ? "停用" : "启用"}</button>
                <button className="ui-button ui-button--danger" disabled={busy === key.id} onClick={() => remove(key)}>删除</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
