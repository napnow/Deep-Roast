import { ApiError } from "@/server/http";

type Waiting = { resolve: () => void; weight: number; cleanup: () => void };
const cancelled = () => new ApiError("图片生成已取消", 499, "IMAGE_GENERATION_CANCELLED");
const busy = () => new ApiError("生图任务较多，请稍后重试", 503, "IMAGE_QUEUE_FULL");

export function createImageConcurrencyLimiter(limit: number, maxWaiting: number) {
  let active = 0;
  const waiting: Waiting[] = [];
  function drain() {
    while (waiting.length && active + waiting[0]!.weight <= limit) {
      const next = waiting.shift()!;
      next.cleanup(); active += next.weight; next.resolve();
    }
  }
  function release(weight: number) { active -= weight; drain(); }
  async function acquire(signal?: AbortSignal, weight = 1) {
    if (signal?.aborted) throw cancelled();
    if (!Number.isInteger(weight) || weight < 1 || weight > limit) throw new Error("Invalid image concurrency weight");
    if (!waiting.length && active + weight <= limit) { active += weight; return; }
    if (waiting.length >= maxWaiting) throw busy();
    await new Promise<void>((resolve, reject) => {
      const remove = (error: Error) => {
        const index = waiting.indexOf(entry);
        if (index < 0) return;
        waiting.splice(index, 1); entry.cleanup(); reject(error); drain();
      };
      const abort = () => remove(cancelled());
      const timer = setTimeout(() => remove(busy()), 300_000);
      const entry: Waiting = { resolve, weight, cleanup: () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); } };
      waiting.push(entry);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
  }
  return {
    async acquire(signal?: AbortSignal, weight = 1): Promise<() => void> {
      await acquire(signal, weight);
      if (signal?.aborted) { release(weight); throw cancelled(); }
      let released = false;
      return () => { if (!released) { released = true; release(weight); } };
    },
    async run<T>(action: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      await acquire(signal);
      try {
        if (signal?.aborted) throw cancelled();
        return await action();
      } finally { release(1); }
    },
  };
}

const limiterKey = Symbol.for("deeproast.imageConcurrency.v1");
const globalStore = globalThis as typeof globalThis & { [limiterKey]?: ReturnType<typeof createImageConcurrencyLimiter> };
export const imageConcurrency = globalStore[limiterKey] ??= createImageConcurrencyLimiter(2, 4);
// Large reference payloads are read only after admission, keeping one image-edit
// HTTP body in application memory at a time while its two operations can run.
const editAdmissionKey = Symbol.for("deeproast.imageEditAdmission.v1");
const editGlobalStore = globalThis as typeof globalThis & { [editAdmissionKey]?: ReturnType<typeof createImageConcurrencyLimiter> };
export const imageEditAdmission = editGlobalStore[editAdmissionKey] ??= createImageConcurrencyLimiter(1, 2);
