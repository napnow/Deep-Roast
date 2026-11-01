import { test } from "node:test";
import assert from "node:assert/strict";
import { createImagePerformance } from "./image-performance";

test("records cumulative stage timings and a bounded privacy-safe result", async () => {
  let now = 10;
  const records: unknown[] = [];
  const perf = createImagePerformance("generate", { now: () => now, emit: (record) => records.push(record), memoryBytes: () => 1234 });
  perf.setModel("model-a");
  perf.attempt();
  await perf.measure("upstream", async () => { now += 20; });
  await assert.rejects(perf.measure("upstream", async () => { now += 5; throw new Error("private detail"); }));
  perf.attempt();
  await perf.measure("processing", async () => { now += 3; });
  now += 2;
  perf.finish("failure");
  perf.finish("failure");
  assert.deepEqual(records, [{ event: "image_performance", mode: "generate", model: "model-a", outcome: "failure", attempts: 2, total_ms: 30, queue_ms: 0, upstream_ms: 25, image_load_ms: 0, reference_ms: 0, processing_ms: 3, storage_ms: 0, database_ms: 0, other_ms: 2, rss_bytes: 1234 }]);
});
