import { parseCanvasLayout, type CanvasLayout } from "./canvas-layout";

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (accountId: string) => `deeproast.canvas-draft.${encodeURIComponent(accountId)}`;

export function readCanvasDraft(storage: DraftStorage, accountId: string): CanvasLayout | null {
  if (!accountId) return null;
  try {
    const value = storage.getItem(key(accountId));
    return value ? parseCanvasLayout(JSON.parse(value)) : null;
  } catch { return null; }
}
export function writeCanvasDraft(storage: DraftStorage, accountId: string, layout: CanvasLayout): boolean {
  if (!accountId) return false;
  try {
    storage.setItem(key(accountId), JSON.stringify(parseCanvasLayout(layout)));
    return true;
  } catch { return false; }
}
export function clearCanvasDraft(storage: DraftStorage, accountId: string): void {
  if (!accountId) return;
  try { storage.removeItem(key(accountId)); } catch { /* Storage can be unavailable. */ }
}
export function sameCanvasContent(a: CanvasLayout, b: CanvasLayout): boolean {
  return JSON.stringify([a.nodes, a.hiddenIds, a.viewport]) === JSON.stringify([b.nodes, b.hiddenIds, b.viewport]);
}

// The memory copy also protects client-side navigation when browser storage is blocked.
const memoryDrafts = new Map<string, CanvasLayout>();
export function saveLocalCanvasDraft(accountId: string, layout: CanvasLayout): void {
  if (!accountId) return;
  try { memoryDrafts.set(accountId, parseCanvasLayout(layout)); } catch { return; }
  try { writeCanvasDraft(window.sessionStorage, accountId, layout); } catch { /* Memory remains available during this page session. */ }
}
export function loadLocalCanvasDraft(accountId: string): CanvasLayout | null {
  if (!accountId) return null;
  const memory = memoryDrafts.get(accountId);
  if (memory) return memory;
  try { return readCanvasDraft(window.sessionStorage, accountId); } catch { return null; }
}
export function clearLocalCanvasDraft(accountId: string): void {
  memoryDrafts.delete(accountId);
  try { clearCanvasDraft(window.sessionStorage, accountId); } catch { /* Storage may be blocked. */ }
}
