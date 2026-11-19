export interface CanvasItem { id: string; x: number; y: number; placeholder?: boolean }

const AUTO_GRID_X = 390;
const AUTO_GRID_Y = 430;
const AUTO_GRID_COLUMNS = 4;

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
      candidate = {id, x: (slot % AUTO_GRID_COLUMNS) * AUTO_GRID_X, y: Math.floor(slot / AUTO_GRID_COLUMNS) * AUTO_GRID_Y};
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

/**
 * Before the dedicated canvas existed, the inline workspace auto-placed every
 * library image on a deterministic 4-column grid. That lattice is the tell for
 * a legacy dump; anything the user moved or linked lands off of it.
 */
export function isAutoAddedGridPosition(x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return false;
  if (x % AUTO_GRID_X !== 0 || y % AUTO_GRID_Y !== 0) return false;
  return x / AUTO_GRID_X < AUTO_GRID_COLUMNS;
}

/**
 * Ids of image nodes that were auto-added before the dedicated canvas existed.
 * Only unlinked, non-placeholder nodes sitting on the canonical lattice
 * qualify, and the dump has to dominate the image nodes so a hand-built layout
 * is never touched.
 */
export function findLegacyAutoAddedCanvasIds(
  nodes: Array<{ id: string; x: number; y: number; placeholder?: boolean }>,
  linkedIds: Iterable<string>,
) {
  const linked = new Set(linkedIds);
  const candidates = nodes.filter(node => !node.placeholder && !linked.has(node.id) && isAutoAddedGridPosition(node.x, node.y));
  if (candidates.length < 3 || candidates.length * 5 < nodes.length * 3) return [];
  return candidates.map(node => node.id);
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
