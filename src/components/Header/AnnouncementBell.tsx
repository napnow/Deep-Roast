"use client";

import { useEffect, useRef, useState } from "react";
import AnnouncementList from "@/components/AnnouncementList";
import { AppIcon } from "@/components/ui/icons";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { formatAnnouncementCount } from "@/lib/announcement-ui";

export default function AnnouncementBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const announcements = useAnnouncements();
  const { load, markSeen, loading, unreadCount } = announcements;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open || loading) return;
    markSeen();
  }, [loading, markSeen, open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const countLabel = formatAnnouncementCount(unreadCount);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        className="announcement-bell__button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="announcement-bell-dialog"
        aria-label={
          unreadCount > 0
            ? `查看公告，${unreadCount} 条未读`
            : "查看公告，无未读公告"
        }
      >
        <span
          key={unreadCount}
          className={`announcement-bell__icon${
            unreadCount > 0 ? " is-unread" : ""
          }`}
        >
          <AppIcon name="bell" size={18} />
        </span>
        {unreadCount > 0 ? (
          <span className="announcement-bell__badge" aria-hidden="true">
            {countLabel}
          </span>
        ) : null}
      </button>

      <span className="sr-only" aria-live="polite">
        {unreadCount > 0 ? `${unreadCount} 条新公告` : "没有未读公告"}
      </span>

      {open ? (
        <div
          id="announcement-bell-dialog"
          role="dialog"
          aria-label="站点公告"
          className="announcement-bell__panel absolute right-0 top-[calc(100%+0.5rem)] z-30 flex max-h-[min(26rem,60vh)] w-[min(24rem,calc(100vw-1.5rem))] flex-col rounded-xl border shadow-lg animate-fade-in"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
              站点公告
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ui-button ui-icon-button"
              aria-label="关闭公告"
            >
              <AppIcon name="close" size={14} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            <AnnouncementList
              items={announcements.items}
              loading={loading}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
