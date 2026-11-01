import { test } from "node:test";
import assert from "node:assert/strict";
import { createImageConcurrencyLimiter } from "./image-concurrency";
import { createServer, request } from "node:http";
import { once } from "node:events";
import { signalFromNodeResponse } from "next/dist/server/web/spec-extension/adapters/next-request";

test("limits running tasks to two and releases slots after failure", async () => {
  const limiter = createImageConcurrencyLimiter(2, 10);
  let running = 0, peak = 0;
  const releases: Array<() => void> = [];
  const work = (fail = false) => limiter.run(async () => {
    running++; peak = Math.max(peak, running);
    await new Promise<void>((resolve) => releases.push(resolve));
    running--;
    if (fail) throw new Error("expected failure");
    return "ok";
  });
  const first = work(), second = work(true), third = work();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(running, 2);
  releases.shift()!();
  await first;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(running, 2);
  releases.shift()!();
  await assert.rejects(second, /expected failure/);
  releases.shift()!();
  assert.equal(await third, "ok");
  assert.equal(peak, 2);
});

test("cancels queued work without executing it or blocking later work", async () => {
  const limiter = createImageConcurrencyLimiter(1, 2);
  let release!: () => void;
  const first = limiter.run(() => new Promise<void>((resolve) => { release = resolve; }));
  const controller = new AbortController();
  let called = false;
  const queued = limiter.run(async () => { called = true; }, controller.signal);
  controller.abort();
  await assert.rejects(queued);
  release(); await first;
  assert.equal(called, false);
  assert.equal(await limiter.run(async () => 42), 42);
});

test("rejects excessive waiting work before it executes", async () => {
  const limiter = createImageConcurrencyLimiter(1, 1);
  let release!: () => void;
  const first = limiter.run(() => new Promise<void>((resolve) => { release = resolve; }));
  const second = limiter.run(async () => "second");
  await assert.rejects(limiter.run(async () => "third"), (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && error.code === "IMAGE_QUEUE_FULL");
  release(); await first;
  assert.equal(await second, "second");
});

test("an exclusive large-image task waits for both slots and blocks other work", async () => {
  const limiter = createImageConcurrencyLimiter(2, 4);
  const releaseOne = await limiter.acquire();
  const releaseTwo = await limiter.acquire();
  let exclusiveStarted = false, laterStarted = false;
  const exclusive = limiter.acquire(undefined, 2).then((release) => { exclusiveStarted = true; return release; });
  const later = limiter.acquire().then((release) => { laterStarted = true; return release; });
  releaseOne(); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(exclusiveStarted, false); assert.equal(laterStarted, false);
  releaseTwo(); const releaseExclusive = await exclusive;
  assert.equal(exclusiveStarted, true); assert.equal(laterStarted, false);
  releaseExclusive(); const releaseLater = await later;
  assert.equal(laterStarted, true); releaseLater();
});

test("a disconnected Node response cancels queued work before it starts", async () => {
  const limiter = createImageConcurrencyLimiter(1, 2);
  let release!: () => void;
  const first = limiter.run(() => new Promise<void>((resolve) => { release = resolve; }));
  await new Promise((resolve) => setImmediate(resolve));
  let started = false, canceled!: () => void, queued!: () => void;
  const canceledPromise = new Promise<void>((resolve) => { canceled = resolve; });
  const queuedPromise = new Promise<void>((resolve) => { queued = resolve; });
  const server = createServer((_req, response) => {
    const signal = signalFromNodeResponse(response);
    void limiter.run(async () => { started = true; }, signal).catch(() => canceled());
    queued();
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing server address");
    const client = request({ host: "127.0.0.1", port: address.port, path: "/" });
    client.on("error", () => {}); client.end();
    await queuedPromise; client.destroy(); await canceledPromise;
    release(); await first;
    assert.equal(started, false);
  } finally { server.close(); }
});
