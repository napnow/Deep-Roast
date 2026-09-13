import assert from "node:assert/strict";
import { test } from "node:test";
import { deferred, plain, respond, sessionFixture, type SessionRequest } from "./session-client-fixture";
import type { useImageActions } from "../hooks/useImageActions";
import type { ImageRecord } from "@/types";

type ImageActions = ReturnType<typeof useImageActions>;
type Fixture = ReturnType<typeof sessionFixture>;
const size = "1024x1024";
const kinds = ["text", "text-batch", "edit", "edit-batch", "delete"] as const;
type Kind = typeof kinds[number];
const image = (id: string): ImageRecord => ({
  id, prompt: id, model: "mock-image", imageUrl: `mock:${id}`, size, createdAt: "mock-time",
});
const edit = (prompt: string) => ({ mode: "per-image" as const, items: [{ image: "mock:input", prompt }] });
function configure(env: Fixture) {
  env.store.getState().setConfig({ imageModel: "mock-image", enabledImageModels: ["mock-image"] });
  env.store.getState().setSelectedImageModel("mock-image");
}
function snapshot(env: Fixture) {
  const s = env.store.getState();
  return plain({ history: s.imageHistory, active: s.activeImageId, generating: s.generating,
    task: s.imageTask, credits: s.credits, walletOpen: s.walletOpen });
}
function start(actions: ImageActions, kind: Kind, label: string) {
  if (kind === "text") return actions.handleGenerateImage(label, size);
  if (kind === "text-batch") return actions.handleGenerateImageBatch(label, size, 2);
  if (kind === "edit") return actions.handleEditImage(edit(label), size);
  if (kind === "edit-batch") return actions.handleEditImageBatch(edit(label), size, 2);
  return actions.handleDeleteImage(label);
}
async function pendingOperation(env: Fixture, actions: ImageActions, kind: Kind, label: string) {
  const index = env.requests.length;
  const completion = start(actions, kind, label);
  if (kind === "text-batch") {
    // One result is already buffered when the second request is cancelled.
    respond(env.requests[index], image(`${label}-buffered`)); await env.flush();
    assert.equal(env.requests.length, index + 2);
  }
  return { completion, request: env.requests.at(-1)! };
}
function succeed(request: SessionRequest, kind: Kind, label: string) {
  if (kind === "text" || kind === "text-batch") respond(request, image(label));
  else if (kind === "delete") respond(request, { success: true });
  else respond(request, { images: [image(label)], total: 2, succeeded: 1, failed: 1,
    refundPending: true, lastError: `${label}: refund pending` });
}

test("session images: all generation paths and deletion reject the previous account's late results", async (t) => {
  for (const kind of kinds) await t.test(kind, async (t) => {
    const env = sessionFixture(); t.after(() => env.dispose());
    env.store.getState().setUserSession("A"); configure(env);
    let creditLoads = 0;
    const images = env.mountImages(async () => { creditLoads++; });
    const oldCallbacks = images.value;
    const old = await pendingOperation(env, images.value, kind, "old");
    env.store.getState().setUserSession(null);
    env.store.getState().setUserSession("B"); configure(env); await env.flush();
    env.store.getState().setImageHistory([image("B")]);
    env.store.getState().setActiveImageId("B");
    env.store.getState().startImageTask({ mode: "text", prompt: "B task", size, count: 1 });
    env.store.getState().setGenerating(true);
    env.store.getState().setCredits(25);
    const before = snapshot(env);
    succeed(old.request, kind, "old-late"); await old.completion; await env.flush();
    assert.deepEqual(snapshot(env), before, "no buffered/late images or task state from A may enter B");
    assert.equal(env.notifications.length, 0, "old refund/error/success notices belong to A, not B");
    assert.equal(creditLoads, 0);
    assert.equal(old.request.init?.signal?.aborted, true);
    oldCallbacks.handleStopGenerateImage();
    assert.deepEqual(snapshot(env), before, "an old user's stop callback must not stop B");
    const count = env.requests.length;
    await oldCallbacks.handleRetryImageTask();
    assert.equal(env.requests.length, count);
  });
});

test("session images: stop/unmount revoke old callbacks and finally without disturbing a new task", async (t) => {
  for (const exit of ["stop", "unmount"] as const) {
    for (const kind of kinds) {
      if (exit === "stop" && kind === "delete") continue;
      await t.test(`${exit}: ${kind}`, async (t) => {
        const env = sessionFixture(); t.after(() => env.dispose());
        env.store.getState().setUserSession("A"); configure(env);
        let creditLoads = 0;
        const loadCredits = async () => { creditLoads++; };
        const oldHook = env.mountImages(loadCredits);
        const old = await pendingOperation(env, oldHook.value, kind, "old");
        if (exit === "stop") oldHook.value.handleStopGenerateImage(); else oldHook.unmount();
        const stoppedWithResult = exit === "stop" && kind === "text-batch";
        const notificationsAfterStop = plain(env.notifications);
        const creditLoadsAfterStop = creditLoads;
        assert.equal(creditLoadsAfterStop, stoppedWithResult ? 1 : 0);
        const currentHook = exit === "stop" ? oldHook : env.mountImages(loadCredits);
        const current = currentHook.value.handleEditImageBatch(edit("current"), size, 2);
        const currentRequest = env.requests.at(-1)!;
        const before = snapshot(env);
        try {
          if (kind === "text" || kind === "text-batch") {
            old.request.reject(new DOMException("mock abort delivered late", "AbortError"));
          } else if (kind === "edit") {
            respond(old.request, { code: "INSUFFICIENT_CREDITS", error: "old credits error" }, 402);
          } else succeed(old.request, kind, "old-late");
          await old.completion; await env.flush();
          assert.deepEqual(snapshot(env), before);
          assert.equal(env.store.getState().generating, true, "old finally must not unlock the current request");
          assert.deepEqual(env.notifications, notificationsAfterStop);
          assert.equal(creditLoads, creditLoadsAfterStop);
          assert.equal(old.request.init?.signal?.aborted, true);
        } finally {
          succeed(currentRequest, "edit-batch", "current"); await current; await env.flush();
        }
        assert.equal(env.store.getState().generating, false);
        assert.deepEqual(plain(env.store.getState().imageHistory.map((item) => item.id)), stoppedWithResult ? ["current", "old-buffered"] : ["current"]);
        assert.deepEqual(env.notifications, [...notificationsAfterStop, ["current: refund pending", "error"]], "keep main's partial-success financial warning");
        assert.equal(creditLoads, creditLoadsAfterStop + 1);
      });
    }
  }
});

test("session image batch: a stale post-success credit refresh cannot warn or clear a newer task", async (t) => {
  for (const exit of ["stop", "unmount"] as const) await t.test(exit, async (t) => {
    const env = sessionFixture(); t.after(() => env.dispose());
    env.store.getState().setUserSession("A"); configure(env);
    const credits = deferred<void>(); let creditLoads = 0;
    const loadCredits = () => ++creditLoads === 1 ? credits.promise : Promise.resolve();
    const oldHook = env.mountImages(loadCredits);
    const old = oldHook.value.handleGenerateImageBatch("old batch", size, 2);
    respond(env.requests[0], image("already-delivered")); await env.flush();
    respond(env.requests[1], { code: "INSUFFICIENT_CREDITS", error: "old batch credits error" }, 402);
    await env.flush();
    assert.equal(creditLoads, 1, "batch is suspended inside its post-success credit refresh");
    if (exit === "stop") oldHook.value.handleStopGenerateImage(); else oldHook.unmount();
    const currentHook = exit === "stop" ? oldHook : env.mountImages(loadCredits);
    const current = currentHook.value.handleEditImage(edit("current single"), size);
    const currentRequest = env.requests.at(-1)!;
    const before = snapshot(env); const notices = plain(env.notifications);
    try {
      credits.resolve(); await old; await env.flush();
      assert.deepEqual(snapshot(env), before);
      assert.deepEqual(env.notifications, notices, "old credit error must not open the wallet or toast after cancellation");
    } finally {
      succeed(currentRequest, "edit", "current single"); await current; await env.flush();
    }
    assert.equal(env.store.getState().generating, false);
    assert.deepEqual(plain(env.store.getState().imageHistory.map((item) => item.id)), ["current single", "already-delivered"]);
    assert.deepEqual(env.notifications.at(-1), ["current single: refund pending", "error"], "single edit keeps main's financial warning too");
  });
});


test("stopping a current batch preserves acknowledged images exactly once", async (t) => {
  for (const outcome of ["abort", "late-success"] as const) await t.test(outcome, async (t) => {
    const env = sessionFixture(); t.after(() => env.dispose());
    env.store.getState().setUserSession("A"); configure(env);
    let creditLoads = 0;
    const images = env.mountImages(async () => { creditLoads++; });
    const pending = images.value.handleGenerateImageBatch("two images", size, 2);
    respond(env.requests[0], image("completed-before-stop"));
    await env.flush();
    assert.equal(env.requests.length, 2);
    images.value.handleStopGenerateImage();
    images.value.handleStopGenerateImage();
    if (outcome === "abort") env.requests[1].reject(new DOMException("synthetic stop", "AbortError"));
    else respond(env.requests[1], image("must-not-appear"));
    await pending; await env.flush();
    assert.deepEqual(plain(env.store.getState().imageHistory.map((item) => item.id)), ["completed-before-stop"]);
    assert.equal(creditLoads, 1);
    assert.equal(env.store.getState().generating, false);
  });
});
