"use client";

import { useCallback, useState } from "react";
import type { Announcement } from "@/types";
import {
  getSeenAnnouncementIds,
  markAnnouncementsSeen,
} from "@/lib/announcement-read";
import { getUnreadAnnouncementCount } from "@/lib/announcement-ui";

/**
 * 公告数据 + 已读状态（供抽屉侧栏 / 用户菜单共用）
 */
export function useAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback((list: Announcement[]) => {
    const seen = getSeenAnnouncementIds();
    const count = getUnreadAnnouncementCount(list, seen);
    setUnreadCount(count);
    setUnread(count > 0);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      if (!res.ok) {
        setItems([]);
        setUnreadCount(0);
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

  /** 打开公告面板时调用：标记当前列表已读 */
  const markSeen = useCallback(() => {
    if (items.length === 0) return;
    markAnnouncementsSeen(items.map((a) => a.id));
    setUnreadCount(0);
    setUnread(false);
  }, [items]);

  return { items, loading, unread, unreadCount, load, markSeen };
}
