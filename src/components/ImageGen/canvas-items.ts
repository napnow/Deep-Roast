export interface CanvasItem { id: string; x: number; y: number; placeholder?: boolean }

export function mergeCanvasItems(previous: CanvasItem[], ids: string[]): CanvasItem[] {
  const uniqueIds = [...new Set(ids)];
  const allowed = new Set(uniqueIds);
  const positions = new Map(previous.filter(item => allowed.has(item.id)).map(item => [item.id, item]));
  const occupied = [...positions.values()];
  return uniqueIds.map((id, index) => {
    const existing = positions.get(id);
    if (existing) return existing;
    let slot = index;
    let candidate: CanvasItem;
    do {
      candidate = {id, x: (slot % 4) * 390, y: Math.floor(slot / 4) * 430};
      slot++;
    } while (occupied.some(item => Math.abs(item.x - candidate.x) < 340 && Math.abs(item.y - candidate.y) < 400));
    occupied.push(candidate);
    return candidate;
  });
}

export function replaceCanvasPlaceholder(items: CanvasItem[], placeholderId: string, imageId: string) {
  return items.map(item => item.id === placeholderId ? { id: imageId, x: item.x, y: item.y } : item);
}

export function mergeCanvasItemsNear(previous: CanvasItem[], ids: string[], anchorId: string) {
  const anchor = previous.find(item => item.id === anchorId);
  if (!anchor) return mergeCanvasItems(previous, ids);
  const occupied = previous.slice();
  const seeded = previous.slice();
  const candidates = [
    { x: anchor.x + 420, y: anchor.y },
    { x: anchor.x + 420, y: anchor.y + 430 },
    { x: anchor.x, y: anchor.y + 430 },
    { x: anchor.x - 420, y: anchor.y },
  ];
  ids.filter(id => !occupied.some(item => item.id === id)).forEach((id, index) => {
    let candidate = candidates[index % candidates.length]!;
    let offset = Math.floor(index / candidates.length) + 1;
    while (occupied.some(item => Math.abs(item.x - candidate.x) < 340 && Math.abs(item.y - candidate.y) < 400)) {
      candidate = { x: anchor.x + 420 * offset, y: anchor.y + 430 * (index % candidates.length) };
      offset += 1;
    }
    const item = { id, x: candidate.x, y: candidate.y };
    occupied.push(item);
    seeded.push(item);
  });
  return mergeCanvasItems(seeded, ids);
}

/** Detect layouts written by the old auto-add mode before the dedicated canvas existed. */
export function isLegacyAutoAddedCanvasLayout(items: CanvasItem[], allIds: string[]) {
  const ids = [...new Set(allIds)];
  if (!ids.length || items.length !== ids.length) return false;
  const expected = new Map(mergeCanvasItems([], ids).map(item => [item.id, item]));
  return items.every(item => {
    const slot = expected.get(item.id);
    return Boolean(slot && slot.x === item.x && slot.y === item.y);
  });
}

/** Only draw links backed by a recorded source when both endpoints are visible. */
export function canvasEdges(images: Array<{ id: string; sourceImageId?: string | null }>) {
  const ids = new Set(images.map(image => image.id));
  return images.flatMap(image => image.sourceImageId && image.sourceImageId !== image.id && ids.has(image.sourceImageId)
    ? [{ id: `${image.sourceImageId}->${image.id}`, source: image.sourceImageId, target: image.id }]
    : []);
}

export function dedupeCanvasEdges<T extends { source?: unknown; target?: unknown }>(edges: T[]): T[] {
  const seen = new Set<string>();
  return edges.filter(edge => {
    if (typeof edge.source !== "string" || typeof edge.target !== "string") return true;
    const key = `${edge.source}\u0000${edge.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
