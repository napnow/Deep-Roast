export function getUnreadAnnouncementCount(
  items: ReadonlyArray<{ id: string }>,
  seenIds: ReadonlySet<string>,
): number {
  return items.reduce(
    (count, item) => count + (seenIds.has(item.id) ? 0 : 1),
    0,
  );
}

export function formatAnnouncementCount(count: number): string {
  return count > 9 ? "9+" : String(Math.max(0, count));
}
