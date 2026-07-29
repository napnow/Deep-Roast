"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Announcement } from "@/types";
import {
  getSeenAnnouncementIds,
  hasUnreadAnnouncements,
  markAnnouncementsSeen,
} from "@/lib/announcement-read";

/**
 * Header 旁的小喇叭：与设置同排。
 * 有未读公告时红点；点开列表后标记已读，红点消失。
 */
export default function AnnouncementBell() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const refreshUnread = useCallback((list: Announcement[]) => {
    setUnread(hasUnreadAnnouncements(list));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (!res.ok) {
        setItems([]);
        setUnread(false);
        return;
      }
      const data = await res.json();
      const list: Announcement[] = Array.isArray(data?.announcements)
        ? data.announcements
        : [];
      setItems(list);
      refreshUnread(list);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [refreshUnread]);

  useEffect(() => {
    load();
  }, [load]);

  // 打开时标记当前列表已读
  useEffect(() => {
    if (!open || items.length === 0) return;
    markAnnouncementsSeen(items.map((a) => a.id));
    setUnread(false);
  }, [open, items]);

  // 点击外部 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
  }

  // 初次 hydrate 后若 localStorage 已有已读，校正红点
  useEffect(() => {
    if (loading || items.length === 0) return;
    const seen = getSeenAnnouncementIds();
    setUnread(items.some((a) => !seen.has(a.id)));
  }, [loading, items]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:opacity-90 relative"
        style={{
          background: open ? "var(--accent-surface)" : "var(--bg-root)",
          border: `1px solid ${
            open
              ? "color-mix(in srgb, var(--accent) 45%, transparent)"
              : "var(--border)"
          }`,
          color: open ? "var(--accent)" : "var(--text-muted)",
        }}
        title={unread ? "有新公告" : "站点公告"}
        aria-label={unread ? "有新公告" : "站点公告"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {/* megaphone / 小喇叭 */}
          <path d="M3 11v2a1 1 0 0 0 1 1h1.5L11 18V6L5.5 10H4a1 1 0 0 0-1 1z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18 6.5a8.5 8.5 0 0 1 0 11" />
        </svg>
        {unread && (
          <span
            className="absolute top-1 right-1 h-2 w-2 rounded-full"
            style={{
              background: "var(--danger)",
              boxShadow: "0 0 0 2px var(--bg-surface), 0 0 6px var(--danger)",
            }}
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="站点公告"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-1.5rem))] animate-fade-up"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div
            className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <p
                className="text-[10px] font-semibold tracking-[0.16em] uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                Broadcast
              </p>
              <p
                className="text-[13px] font-semibold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                站点公告
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] px-2 py-1 rounded-md"
              style={{
                color: "var(--text-muted)",
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
              }}
            >
              关闭
            </button>
          </div>

          <div className="max-h-[min(22rem,50vh)] overflow-y-auto p-2.5">
            {loading ? (
              <p
                className="text-xs text-center py-8"
                style={{ color: "var(--text-muted)" }}
              >
                加载中…
              </p>
            ) : items.length === 0 ? (
              <p
                className="text-xs text-center py-8"
                style={{ color: "var(--text-muted)" }}
              >
                暂无公告
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-[var(--radius)] px-3 py-2.5"
                    style={{
                      background: "var(--bg-root)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p
                      className="text-[12.5px] leading-relaxed whitespace-pre-wrap"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {a.body}
                    </p>
                    <p
                      className="text-[10px] mt-1.5 tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.createdAt
                        ? new Date(a.createdAt).toLocaleString("zh-CN")
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
