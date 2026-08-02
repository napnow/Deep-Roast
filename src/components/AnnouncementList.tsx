"use client";

import type { Announcement } from "@/types";

interface AnnouncementListProps {
  items: Announcement[];
  loading: boolean;
}

/** 公告列表（纯展示：加载态 / 空态 / 列表） */
export default function AnnouncementList({
  items,
  loading,
}: AnnouncementListProps) {
  if (loading) {
    return (
      <p
        className="text-xs text-center py-8"
        style={{ color: "var(--text-muted)" }}
      >
        加载中…
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p
        className="text-xs text-center py-8"
        style={{ color: "var(--text-muted)" }}
      >
        暂无公告
      </p>
    );
  }
  return (
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
          <p className="text-[10px] mt-1.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
            {a.createdAt ? new Date(a.createdAt).toLocaleString("zh-CN") : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
