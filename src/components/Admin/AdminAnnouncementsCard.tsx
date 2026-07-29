"use client";

import { useCallback, useEffect, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";
import type { Announcement } from "@/types";

export default function AdminAnnouncementsCard() {
  const [list, setList] = useState<Announcement[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ announcements: Announcement[] }>(
        "/api/admin/announcements",
      );
      setList(data.announcements || []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "加载失败");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    setMsg("");
    try {
      await apiJson("/api/admin/announcements", {
        method: "POST",
        ...jsonBody({ body: text }),
      });
      setBody("");
      setMsg("✓ 公告已发布");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "发布失败");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("删除该公告？")) return;
    setSaving(true);
    setMsg("");
    try {
      await apiJson(`/api/admin/announcements/${id}`, { method: "DELETE" });
      setMsg("✓ 已删除");
      await load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "删除失败");
    }
    setSaving(false);
  }

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  } as const;

  return (
    <div
      className="rounded-xl border p-4 text-left space-y-3"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
        站点公告
      </p>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        纯文本，展示在登录页与站内；按发布时间倒序。
      </p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="输入公告内容…"
        className="w-full rounded-lg px-3 py-2 text-xs resize-y"
        style={inputStyle}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving || !body.trim()}
          onClick={create}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
          style={{
            background: "var(--accent-surface)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          {saving ? "处理中…" : "发布公告"}
        </button>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {body.length}/2000
        </span>
      </div>

      {loading ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          加载中…
        </p>
      ) : list.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          暂无公告
        </p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto">
          {list.map((a) => (
            <li
              key={a.id}
              className="rounded-lg px-3 py-2 text-xs"
              style={{ background: "var(--bg-root)" }}
            >
              <div className="flex justify-between gap-2 items-start">
                <p
                  className="whitespace-pre-wrap flex-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {a.body}
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => remove(a.id)}
                  className="text-[10px] shrink-0"
                  style={{ color: "var(--danger)" }}
                >
                  删除
                </button>
              </div>
              <p
                className="text-[10px] mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {a.createdAt
                  ? new Date(a.createdAt).toLocaleString("zh-CN")
                  : "-"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {msg && (
        <p
          className="text-[11px]"
          style={{
            color: msg.startsWith("✓") ? "var(--success)" : "var(--danger)",
          }}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
