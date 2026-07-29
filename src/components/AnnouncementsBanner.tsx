"use client";

import { useEffect, useState } from "react";
import type { Announcement } from "@/types";

/** 登录后顶栏下方展示最新公告（可关闭本次会话） */
export default function AnnouncementsBanner() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/announcements")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.announcements?.length) setItems(d.announcements.slice(0, 3));
      })
      .catch(() => {});
  }, []);

  if (dismissed || items.length === 0) return null;

  return (
    <div
      className="border-b px-4 py-2 flex gap-3 items-start"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex-1 min-w-0 space-y-1">
        {items.map((a) => (
          <div key={a.id} className="text-xs">
            <span
              className="font-semibold mr-2"
              style={{ color: "var(--accent)" }}
            >
              公告
            </span>
            <span style={{ color: "var(--text-secondary)" }}>{a.body}</span>
            <span
              className="ml-2 text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {a.createdAt
                ? new Date(a.createdAt).toLocaleString("zh-CN")
                : ""}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-[10px] shrink-0 px-1.5 py-0.5 rounded"
        style={{ color: "var(--text-muted)" }}
        title="关闭"
      >
        ✕
      </button>
    </div>
  );
}
