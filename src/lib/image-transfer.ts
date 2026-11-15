import { BrowserActionError } from "./browser-actions";
import { useDeepRoastStore } from "./store";

type Entry = { controller: AbortController; promise: Promise<Blob>; consumers: number };
type Waiter = { signal: AbortSignal; resolve: () => void; reject: (error: DOMException) => void };

export function createImageTransfer(request: typeof fetch = fetch) {
  const inFlight = new Map<string, Entry>();
  let currentEpoch: number | null = null;
  let cached: { url: string; blob: Blob } | null = null;
  let expiry: ReturnType<typeof setTimeout> | null = null;
  let active = 0;
  const waiters: Waiter[] = [];
  async function acquire(signal: AbortSignal): Promise<void> {
    if (active < 2) { active++; return; }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const waiter: Waiter = { signal, resolve, reject };
      const cleanup = () => signal.removeEventListener("abort", cancel);
      const grant = () => {
        if (settled) return;
        settled = true;
        cleanup();
        active++;
        resolve();
      };
      const cancel = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
      waiters.push({ signal, resolve: grant, reject });
      signal.addEventListener("abort", cancel, { once: true });
    });
  }
  function release() {
    active--;
    let next = waiters.shift();
    while (next) {
      if (!next.signal.aborted) {
        next.resolve();
        return;
      }
      next.reject(new DOMException("Aborted", "AbortError"));
      next = waiters.shift();
    }
  }
  function clear() {
    if (expiry) clearTimeout(expiry);
    expiry = null;
    cached = null;
    for (const entry of inFlight.values()) entry.controller.abort();
    inFlight.clear();
    currentEpoch = null;
  }
  function discard(url: string) {
    if (cached?.url !== url) return;
    cached = null;
    if (expiry) clearTimeout(expiry);
    expiry = null;
  }
  function consume(url: string, entry: Entry, signal?: AbortSignal): Promise<Blob> {
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    entry.consumers++;
    return new Promise<Blob>((resolve, reject) => {
      let done = false;
      const finish = () => {
        if (done) return false;
        done = true;
        signal?.removeEventListener("abort", cancel);
        entry.consumers--;
        return true;
      };
      const cancel = () => {
        if (!finish()) return;
        if (entry.consumers === 0 && inFlight.get(url) === entry) {
          inFlight.delete(url);
          entry.controller.abort();
        }
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", cancel, { once: true });
      entry.promise.then((blob) => { if (finish()) resolve(blob); }, (error) => { if (finish()) reject(error); });
    });
  }
  function get(url: string, epoch: number, signal?: AbortSignal): Promise<Blob> {
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    if (currentEpoch !== epoch) { clear(); currentEpoch = epoch; }
    if (cached?.url === url) return Promise.resolve(cached.blob);
    const existing = inFlight.get(url);
    if (existing) return consume(url, existing, signal);
    const controller = new AbortController();
    const current: Entry = { controller, promise: Promise.resolve(new Blob()), consumers: 0 };
    current.promise = (async () => {
      let acquired = false;
      try {
        await acquire(controller.signal);
        acquired = true;
        controller.signal.throwIfAborted();
        const response = await request(url, { signal: controller.signal });
        if (!response.ok) throw new BrowserActionError(response.status === 401 || response.status === 403 ? "下载未完成，请确认登录状态和图片权限。" : "图片暂时无法加载，请稍后重试。");
        const blob = await response.blob();
        if (!blob.size || !blob.type.toLowerCase().startsWith("image/")) throw new BrowserActionError("返回的内容不是有效图片。");
        controller.signal.throwIfAborted();
        if (inFlight.get(url) === current && currentEpoch === epoch) {
          if (expiry) clearTimeout(expiry);
          cached = blob.size <= 12 * 1024 * 1024 ? { url, blob } : null;
          if (cached) {
            expiry = setTimeout(() => { cached = null; expiry = null; }, 120_000);
            if (typeof expiry === "object" && "unref" in expiry) expiry.unref();
          }
        }
        return blob;
      } finally {
        if (acquired) release();
        if (inFlight.get(url) === current) inFlight.delete(url);
      }
    })();
    inFlight.set(url, current);
    return consume(url, current, signal);
  }
  return { get, clear, discard };
}

const transfer = createImageTransfer();
export function discardSessionImage(url: string) {
  transfer.discard(url);
}
let subscribed = false;
export function getSessionImage(url: string, signal?: AbortSignal): Promise<Blob> {
  if (!subscribed) {
    useDeepRoastStore.subscribe((state, previous) => {
      if (state.userSessionVersion !== previous.userSessionVersion) transfer.clear();
    });
    subscribed = true;
  }
  return transfer.get(url, useDeepRoastStore.getState().userSessionVersion, signal);
}
