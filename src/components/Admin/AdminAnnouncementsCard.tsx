"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/client-api";
import type { Announcement } from "@/types";

export default function AdminAnnouncementsCard() {
  const [list, setList] = useState<Announcement[]>([]);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ announcements: Announcement[] }>(
        "/api/admin/announcements",
      );
      setList(data.announcements || []);
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "加载失败");
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
      const form = new FormData();
      form.set("body", text);
      if (image) form.set("image", image);
      await apiJson("/api/admin/announcements", {
        method: "POST",
        body: form,
      });
      setBody("");
      setImage(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      setMsg("公告已发布");
      await load();
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "发布失败");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("删除这条公告？")) return;
    setSaving(true);
    setMsg("");
    try {
      await apiJson(`/api/admin/announcements/${id}`, { method: "DELETE" });
      setMsg("已删除");
      await load();
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "删除失败");
    }
    setSaving(false);
  }

  async function togglePin(id: string) {
    setSaving(true);
    setMsg("");
    try {
      await apiJson(`/api/admin/announcements/${id}`, { method: "PATCH" });
      await load();
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "操作失败");
    }
    setSaving(false);
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <p className="admin-kicker">Broadcast</p>
          <h2 className="admin-title text-lg mt-1">站点公告</h2>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            登录页与站内横幅 · 按时间倒序
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
          {list.length}
        </span>
      </div>
      <div className="admin-card-body space-y-4">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="输入公告内容"
          className="admin-input resize-y min-h-[4.5rem]"
        />
        <div className="rounded-[var(--radius)] border border-dashed p-3 space-y-2" style={{ borderColor: "var(--border-strong)" }}>
          <label className="text-xs font-medium" htmlFor="announcement-qr-image">
            微信群二维码（可选）
          </label>
          <input
            id="announcement-qr-image"
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            className="block w-full text-[11px]"
          />
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            支持 PNG / JPG / WebP，最大 2MB；用户端点击箭头后查看。
          </p>
          {image && (
            <div className="flex items-center gap-3">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded border text-center text-[10px]" style={{ color: "var(--accent, #ff8c00)" }}>
                二维码
              </span>
              <span className="min-w-0 truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {image.name}
              </span>
              <button type="button" onClick={() => { setImage(null); if (imageInputRef.current) imageInputRef.current.value = ""; }} className="text-[11px]" style={{ color: "var(--danger)" }}>
                清除
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving || !body.trim()}
            onClick={create}
            className="admin-btn admin-btn--solid"
          >
            {saving ? "处理中…" : "发布公告"}
          </button>
          <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {body.length}/2000
          </span>
        </div>

        {loading ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>加载中…</p>
        ) : list.length === 0 ? (
          <div
            className="rounded-[var(--radius)] px-3 py-6 text-center text-xs"
            style={{
              background: "var(--bg-root)",
              color: "var(--text-muted)",
              border: "1px dashed var(--border-strong)",
            }}
          >
            暂无公告
          </div>
        ) : (
          <ul className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {list.map((announcement) => (
              <li
                key={announcement.id}
                className="rounded-[var(--radius)] px-3 py-2.5"
                style={{
                  background: announcement.pinned ? "var(--accent-bg, rgba(255,140,0,0.06))" : "var(--bg-root)",
                  border: `1px solid ${announcement.pinned ? "var(--accent, #ff8c00)" : "var(--border)"}`,
                }}
              >
                <div className="flex justify-between gap-3 items-start">
                  <p className="text-[12.5px] whitespace-pre-wrap flex-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {announcement.pinned && <span style={{ color: "var(--accent, #ff8c00)" }}>📌 </span>}
                    {announcement.body}
                    {announcement.imageUrl && <span className="ml-1 text-[10px]" style={{ color: "var(--accent, #ff8c00)" }}>（含二维码）</span>}
                  </p>
                  <div className="flex gap-2 shrink-0 pt-0.5">
                    <button type="button" disabled={saving} onClick={() => togglePin(announcement.id)} className="text-[10px] font-semibold" style={{ color: announcement.pinned ? "var(--accent, #ff8c00)" : "var(--text-muted)" }}>
                      {announcement.pinned ? "取消置顶" : "置顶"}
                    </button>
                    <button type="button" disabled={saving} onClick={() => remove(announcement.id)} className="text-[10px] font-semibold" style={{ color: "var(--danger)" }}>
                      删除
                    </button>
                  </div>
                </div>
                <p className="text-[10px] mt-1.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {announcement.createdAt ? new Date(announcement.createdAt).toLocaleString("zh-CN") : "-"}
                </p>
              </li>
            ))}
          </ul>
        )}

        {msg && (
          <p className="text-[11px] font-medium" style={{ color: /失败|错误/.test(msg) ? "var(--danger)" : "var(--success)" }}>
            {msg}
          </p>
        )}
      </div>
    </section>
  );
}
