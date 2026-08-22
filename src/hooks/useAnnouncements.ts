"use client";

import { useCallback, useEffect, useState } from "react";
import type { Announcement } from "@/types";
import {
  getSeenAnnouncementIds,
  hasUnreadAnnouncements,
  markAnnouncementsSeen,
} from "@/lib/announcement-read";

/**
 * 公告数据 + 已读状态（供抽屉侧栏 / 用户菜单共用）
 */
export function useAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(false);

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

  // 初次 hydrate 后校正红点（localStorage 已有已读记录时）
  useEffect(() => {
    if (loading || items.length === 0) return;
    const seen = getSeenAnnouncementIds();
    setUnread(items.some((a) => !seen.has(a.id)));
  }, [loading, items]);

  /** 打开公告面板时调用：标记当前列表已读 */
  const markSeen = useCallback(() => {
    if (items.length === 0) return;
    markAnnouncementsSeen(items.map((a) => a.id));
    setUnread(false);
  }, [items]);

  return { items, loading, unread, load, markSeen };
}
