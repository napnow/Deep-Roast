import assert from "node:assert/strict";
import test from "node:test";
import { createImageTransfer } from "./image-transfer";

test("preview and download share one in-flight original image request", async () => {
  let calls = 0;
  const transfer = createImageTransfer(async () => { calls++; return new Response(new Blob(["image"], {type:"image/png"})); });
  const [preview, download] = await Promise.all([transfer.get("/image", 1), transfer.get("/image", 1)]);
  assert.equal(calls, 1);
  assert.equal(preview, download);
});

test("session changes clear cached data and do not reuse another user's image", async () => {
  let calls = 0;
  const transfer = createImageTransfer(async () => { calls++; return new Response(new Blob([String(calls)], {type:"image/png"})); });
  assert.equal(await (await transfer.get("/image", 1)).text(), "1");
  assert.equal(await (await transfer.get("/image", 2)).text(), "2");
  assert.equal(calls, 2);
});

test("failures are never cached and a later request can retry", async () => {
  let calls = 0;
  const transfer = createImageTransfer(async () => ++calls === 1 ? new Response(null, {status:403}) : new Response(new Blob(["ok"], {type:"image/png"})));
  await assert.rejects(transfer.get("/image", 1));
  assert.equal(await (await transfer.get("/image", 1)).text(), "ok");
});

test("switching sessions aborts the old in-flight request", async () => {
  let aborted = false;
  const transfer = createImageTransfer((async (_url, init) => {
    if (!aborted && init?.signal) return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); });
    });
    return new Response(new Blob(["new"], {type:"image/png"}));
  }) as typeof fetch);
  const previous = transfer.get("/image", 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const next = transfer.get("/image", 2);
  await assert.rejects(previous, { name: "AbortError" });
  assert.equal(await (await next).text(), "new");
});

test("loading a second image does not cancel a download of the first", async () => {
  const resolves: Array<(r: Response) => void> = [];
  const transfer = createImageTransfer((_url, init) => new Promise<Response>((resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    resolves.push(resolve);
  }));
  const first = transfer.get("/a", 1);
  const second = transfer.get("/b", 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  resolves[0](new Response(new Blob(["A"], {type:"image/png"})));
  resolves[1](new Response(new Blob(["B"], {type:"image/png"})));
  assert.equal(await (await first).text(), "A");
  assert.equal(await (await second).text(), "B");
});

test("at most two original requests run at the same time", async () => {
  const resolves: Array<(r: Response) => void> = [];
  const transfer = createImageTransfer(() => new Promise<Response>((resolve) => resolves.push(resolve)));
  const a = transfer.get("/a", 1), b = transfer.get("/b", 1), c = transfer.get("/c", 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(resolves.length, 2);
  resolves[0](new Response(new Blob(["a"], {type:"image/png"})));
  await a;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(resolves.length, 3);
  resolves[1](new Response(new Blob(["b"], {type:"image/png"})));
  resolves[2](new Response(new Blob(["c"], {type:"image/png"})));
  await Promise.all([b,c]);
});

test("aborting a queued preview does not delay the next current image", async () => {
  const started: string[] = [];
  const resolves = new Map<string, (r: Response) => void>();
  const transfer = createImageTransfer((url, init) => new Promise<Response>((resolve, reject) => {
    const key = String(url);
    started.push(key);
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    resolves.set(key, resolve);
  }));
  const a = transfer.get("/a", 1);
  const b = transfer.get("/b", 1);
  const stale = new AbortController();
  const c = transfer.get("/c", 1, stale.signal);
  const current = transfer.get("/d", 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  stale.abort();
  await assert.rejects(c, { name: "AbortError" });
  resolves.get("/a")!(new Response(new Blob(["a"], {type:"image/png"})));
  await a;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(started, ["/a", "/b", "/d"]);
  resolves.get("/b")!(new Response(new Blob(["b"], {type:"image/png"})));
  resolves.get("/d")!(new Response(new Blob(["d"], {type:"image/png"})));
  await Promise.all([b, current]);
});

test("closing a preview cancels its request only when no download shares it", async () => {
  let resolve!: (r: Response) => void;
  let aborted = false;
  const transfer = createImageTransfer((_url, init) => new Promise<Response>((done, reject) => {
    resolve = done;
    init?.signal?.addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); });
  }));
  const previewAbort = new AbortController();
  const preview = transfer.get("/a", 1, previewAbort.signal);
  const download = transfer.get("/a", 1);
  await new Promise((r) => setTimeout(r, 0));
  previewAbort.abort();
  await assert.rejects(preview, {name:"AbortError"});
  assert.equal(aborted, false);
  resolve(new Response(new Blob(["image"], {type:"image/png"})));
  assert.equal(await (await download).text(), "image");
});
