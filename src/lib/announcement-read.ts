/** 公告已读状态（localStorage，按公告 id） */

const STORAGE_KEY = "dr_announcement_seen_v1";
const MAX_SEEN = 120;

export function getSeenAnnouncementIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(String));
  } catch {
    return new Set();
  }
}

export function markAnnouncementsSeen(ids: string[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  const seen = getSeenAnnouncementIds();
  for (const id of ids) seen.add(id);
  // 保留尾部，避免无限增长
  const list = Array.from(seen);
  const trimmed =
    list.length > MAX_SEEN ? list.slice(list.length - MAX_SEEN) : list;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota
  }
}

export function hasUnreadAnnouncements(
  items: Array<{ id: string }>,
): boolean {
  if (!items.length) return false;
  const seen = getSeenAnnouncementIds();
  return items.some((a) => !seen.has(a.id));
}
