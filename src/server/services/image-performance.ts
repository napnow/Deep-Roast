import { performance } from "node:perf_hooks";
import { memoryUsage } from "node:process";

type Stage = "upstream" | "image_load" | "reference" | "processing" | "storage" | "database";
type Mode = "generate" | "edit";
type Outcome = "success" | "failure";
type Dependencies = { now: () => number; emit: (record: Record<string, unknown>) => void; memoryBytes: () => number };

export function createImagePerformance(mode: Mode, dependencies?: Dependencies) {
  const now = dependencies?.now ?? (() => performance.now());
  const emit = dependencies?.emit ?? ((record) => console.info("[image-performance]", JSON.stringify(record)));
  const memoryBytes = dependencies?.memoryBytes ?? (() => memoryUsage().rss);
  const started = now();
  const durations: Record<Stage, number> = { upstream: 0, image_load: 0, reference: 0, processing: 0, storage: 0, database: 0 };
  let model = "unknown";
  let attempts = 0;
  let finished = false;
  return {
    setModel(value: string) { model = value.slice(0, 100); },
    attempt() { attempts += 1; },
    async measure<T>(stage: Stage, action: () => Promise<T>): Promise<T> {
      const start = now();
      try { return await action(); }
      finally { durations[stage] += Math.max(0, now() - start); }
    },
    finish(outcome: Outcome) {
      if (finished) return;
      finished = true;
      try {
        const total = Math.max(0, now() - started);
        const sum = Object.values(durations).reduce((a, b) => a + b, 0);
        emit({ event: "image_performance", mode, model, outcome, attempts,
          total_ms: Math.round(total), upstream_ms: Math.round(durations.upstream),
          image_load_ms: Math.round(durations.image_load), reference_ms: Math.round(durations.reference),
          processing_ms: Math.round(durations.processing), storage_ms: Math.round(durations.storage),
          database_ms: Math.round(durations.database), other_ms: Math.round(Math.max(0, total - sum)),
          rss_bytes: memoryBytes() });
      } catch { /* Telemetry must never change generation behavior. */ }
    },
  };
}
export type ImagePerformance = ReturnType<typeof createImagePerformance>;
