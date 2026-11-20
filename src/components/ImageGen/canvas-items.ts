export interface CanvasItem { id: string; x: number; y: number; placeholder?: boolean }

const AUTO_GRID_X = 390;
const AUTO_GRID_Y = 430;
const AUTO_GRID_COLUMNS = 4;
const NEAR_NODE_WIDTH = 320;
const NEAR_NODE_HEIGHT = 400;

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
    let attempt = index;
    let candidate: { x: number; y: number };
    do {
      const direction = candidates[attempt % candidates.length]!;
      const ring = Math.floor(attempt / candidates.length) + 1;
      candidate = {
        x: anchor.x + (direction.x - anchor.x) * ring,
        y: anchor.y + (direction.y - anchor.y) * ring,
      };
      attempt += 1;
    } while (occupied.some(item => Math.abs(item.x - candidate.x) < NEAR_NODE_WIDTH && Math.abs(item.y - candidate.y) < NEAR_NODE_HEIGHT));
    const item = { id, x: candidate.x, y: candidate.y };
    occupied.push(item);
    seeded.push(item);
  });
  return mergeCanvasItems(seeded, ids);
}

/** Placement hints captured before a render, so the state updater stays pure. */
export interface CanvasAdditionPlacement {
  /** New image id → placeholder node id it fills in. */
  placeholders?: ReadonlyMap<string, string>;
  /** New image id → node id it should be laid out next to. */
  anchors?: ReadonlyMap<string, string>;
}

/**
 * Merge freshly generated images into an existing layout.
 *
 * Every other node is preserved: React may re-invoke a `setState` updater, so a
 * second call with the same (or already consumed) hints has to produce the same
 * layout instead of collapsing the canvas down to the new node.
 */
export function placeCanvasAdditions(
  items: CanvasItem[],
  additions: string[],
  placement: CanvasAdditionPlacement = {},
  occupied: CanvasItem[] = [],
): CanvasItem[] {
  const placeholders = placement.placeholders ?? new Map<string, string>();
  const anchors = placement.anchors ?? new Map<string, string>();
  const replacements = new Map<string, string>();
  let next = items.slice();
  for (const id of additions) {
    const placeholderId = placeholders.get(id);
    if (placeholderId && next.some(item => item.id === placeholderId)) {
      // A late hint still wins over a copy that a previous pass parked on the grid.
      next = replaceCanvasPlaceholder(next.filter(item => item.id !== id), placeholderId, id);
      replacements.set(placeholderId, id);
      continue;
    }
    const requestedAnchor = anchors.get(id);
    const anchorId = requestedAnchor ? replacements.get(requestedAnchor) ?? requestedAnchor : undefined;
    if (anchorId && [...next, ...occupied].some(item => item.id === anchorId)) {
      const others = next.filter(item => item.id !== id);
      next = mergeCanvasItemsNear([...others, ...occupied], [...others.map(item => item.id), id], anchorId);
      continue;
    }
    if (next.some(item => item.id === id)) continue;
    next = mergeCanvasItems(next, [...next.map(item => item.id), id]);
  }
  return next;
}

/** Remove links to a filled placeholder and move its downstream links onto the result. */
export function replacePlaceholderConnections<T extends { source?: unknown; target?: unknown }>(
  edges: T[],
  placeholderId: string,
  replacementId: string,
): T[] {
  return edges.flatMap(edge => {
    if (edge.target === placeholderId) return [];
    if (edge.source === placeholderId) return [{ ...edge, source: replacementId } as T];
    return [edge];
  });
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
