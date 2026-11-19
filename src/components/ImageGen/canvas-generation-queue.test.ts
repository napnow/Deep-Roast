import assert from "node:assert/strict";
import test from "node:test";
import { createCanvasGenerationQueue } from "./canvas-generation-queue";

test("starts only two jobs and promotes the next queued node", async () => {
  const started: string[] = [];
  const finishers = new Map<string, () => void>();
  const queue = createCanvasGenerationQueue({ limit: 2 });
  const run = (nodeId: string) => (signal: AbortSignal) => new Promise<{ completed: number; failed: number }>(resolve => {
    void signal;
    started.push(nodeId);
    finishers.set(nodeId, () => resolve({ completed: 1, failed: 0 }));
  });
  queue.enqueue({ nodeId: "a", count: 1, run: run("a") });
  queue.enqueue({ nodeId: "b", count: 1, run: run("b") });
  queue.enqueue({ nodeId: "c", count: 1, run: run("c") });
  await Promise.resolve();
  assert.deepEqual(started, ["a", "b"]);
  assert.equal(queue.get("c")?.status, "queued");
  finishers.get("a")!();
  await queue.whenIdle("a");
  await Promise.resolve();
  assert.deepEqual(started, ["a", "b", "c"]);
  queue.dispose();
});

test("cancelling a queued job never calls its runner", async () => {
  let called = false;
  const queue = createCanvasGenerationQueue({ limit: 1 });
  queue.enqueue({ nodeId: "a", count: 1, run: async () => new Promise(() => {}) });
  queue.enqueue({ nodeId: "b", count: 1, run: async () => { called = true; return { completed: 1, failed: 0 }; } });
  assert.equal(queue.cancel("b"), true);
  assert.equal(called, false);
  assert.equal(queue.get("b")?.status, "cancelled");
  queue.dispose();
});

test("active cancellation aborts only its own signal and records cancellation", async () => {
  let aborted = false;
  const queue = createCanvasGenerationQueue({ limit: 2 });
  queue.enqueue({ nodeId: "a", count: 1, run: signal => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(Object.assign(new Error("cancelled"), { name: "AbortError" })); }, { once: true });
  }) });
  await Promise.resolve();
  assert.equal(queue.cancel("a"), true);
  await queue.whenIdle("a");
  assert.equal(aborted, true);
  assert.equal(queue.get("a")?.status, "cancelled");
});
