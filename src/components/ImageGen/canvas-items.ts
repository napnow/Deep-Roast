export interface CanvasItem { id: string; x: number; y: number }

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
