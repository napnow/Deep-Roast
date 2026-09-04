"use client";

import { useState } from "react";
import type { Announcement } from "@/types";

interface AnnouncementListProps {
  items: Announcement[];
  loading: boolean;
}

export default function AnnouncementList({
  items,
  loading,
}: AnnouncementListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  function toggleImage(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
      {items.map((a) => {
        const expanded = expandedIds.has(a.id);
        return (
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
            {a.imageUrl && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => toggleImage(a.id)}
                  aria-expanded={expanded}
                  aria-controls={`announcement-image-${a.id}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors"
                  style={{ color: "var(--accent, #ff8c00)" }}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}
                  >
                    ›
                  </span>
                  查看微信群二维码
                </button>
                {expanded && (
                  <div
                    id={`announcement-image-${a.id}`}
                    className="mt-2 overflow-hidden rounded-lg border p-2"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {/* The authenticated QR endpoint is intentionally rendered without Next image transformation. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.imageUrl}
                      alt="微信群二维码"
                      className="block max-w-full max-h-[min(60vh,28rem)] w-auto h-auto mx-auto object-contain rounded"
                    />
                  </div>
                )}
              </div>
            )}
            <p
              className="text-[10px] mt-1.5 tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              {a.createdAt ? new Date(a.createdAt).toLocaleString("zh-CN") : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
