import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { ImageToImageDraft } from "@/lib/image-workspace";

import { sessionFixture, sessionUser } from "../../lib/session-client-fixture";

import { createUploadHarness } from "./upload-lifecycle-fixture";

function harness(t: TestContext, props: Parameters<typeof createUploadHarness>[0] = {}) {
  const panel = createUploadHarness(props);
  t.after(() => panel.unmount());
  return panel;
}

function draft(): ImageToImageDraft {
  return {
    refs: ["draft-D", "draft-E"].map((name) => ({
      preview: `preview:${name}`,
      base64: `data:image/png;base64,${name}`,
    })),
    prompt: "保留草稿主体，改成海边日落",
    size: "1024x1536",
    count: 2,
    styleId: "",
    styleColor: "",
    styleTexture: "",
  };
}

function item(name: string, prompt: string, targetIndex: number) {
  return { image: `data:image/png;base64,${name}`, prompt, targetIndex };
}

test("clearAll excludes late old-B compression from the new-C count=3 request", async (t) => {
  const panel = harness(t);
  panel.upload(["old-A", "old-B"]);
  await panel.finishCompression("old-A");
  assert.deepEqual(panel.previews(), ["preview:old-A"]);

  panel.click("清空全部");
  assert.deepEqual(panel.previews(), []);
  panel.upload(["new-C"]);
  await panel.finishCompression("new-C");
  panel.setPrompt("只修改新图 C");
  await panel.finishCompression("old-B");
  panel.click("3 张");
  await panel.click("生成图片");

  assert.deepEqual(panel.submissions, [{
    kind: "batch",
    request: { mode: "per-image", items: [item("new-C", "只修改新图 C", 0)] },
    size: "1024x1024",
    count: 3,
  }]);
  assert.deepEqual(panel.previews(), ["preview:new-C"]);
  assert.deepEqual(panel.errors(), []);
});

test("draft replacement ignores old compression and preserves restored prompts, size and count", async (t) => {
  const panel = harness(t);
  panel.upload(["old-A", "old-B"]);
  await panel.finishCompression("old-A");
  panel.setPrompt("已丢弃的旧指令");

  const restored = draft();
  panel.render({ draft: restored });
  assert.equal(panel.prompt(), restored.prompt);
  assert.equal(panel.button("选择图片 1").props["aria-pressed"], true);
  await panel.finishCompression("old-B");
  panel.upload(["new-F"]);
  await panel.finishCompression("new-F");
  panel.click("选择图片 3");
  panel.setPrompt("只修改新图 F");
  panel.click("选择图片 2");
  assert.equal(panel.prompt(), restored.prompt);
  await panel.click("生成图片");

  assert.deepEqual(panel.submissions, [{
    kind: "batch",
    request: { mode: "per-image", items: [
      item("draft-D", restored.prompt, 0),
      item("draft-E", restored.prompt, 1),
      item("new-F", "只修改新图 F", 2),
    ] },
    size: restored.size,
    count: restored.count,
  }]);
  assert.deepEqual(panel.previews(), ["preview:draft-D", "preview:draft-E", "preview:new-F"]);
});

for (const boundary of ["clearAll", "draft replacement", "unmount"] as const) {
  test(`${boundary} aborts pending FileReaders and ignores already-queued read callbacks`, async (t) => {
    const panel = harness(t);
    const [completedReader] = panel.upload(["ready-A"]);
    await panel.finishCompression("ready-A");
    const [pendingReader] = panel.upload(["pending-read"], false);
    const lateLoad = pendingReader!.onload;
    const lateError = pendingReader!.onerror;
    assert.ok(lateLoad, "a FileReader load callback must be pending");

    if (boundary === "clearAll") panel.click("清空全部");
    else if (boundary === "draft replacement") panel.render({ draft: draft() });
    else panel.unmount();

    // A queued browser callback may survive cancellation. Invoke the saved
    // functions too, so detaching handlers alone cannot satisfy this test.
    lateLoad();
    lateError?.();
    await panel.flush();
    assert.equal(panel.hasCompression("pending-read"), false, "obsolete reads must not start compression");
    assert.equal(pendingReader!.abortCalls, 1, "a loading reader must be cancelled");
    assert.equal(completedReader!.abortCalls, 0, "completed readers must not be retained or aborted");
    assert.equal(panel.writesAfterUnmount, 0);
    assert.deepEqual(panel.errors(), []);
    if (boundary === "clearAll") assert.deepEqual(panel.previews(), []);
    if (boundary === "draft replacement") assert.deepEqual(panel.previews(), ["preview:draft-D", "preview:draft-E"]);
  });
}

for (const boundary of ["clearAll", "draft replacement"] as const) {
  test(`${boundary} suppresses an obsolete compression rejection`, async (t) => {
    const panel = harness(t);
    panel.upload(["ready-A", "failed-old-B"]);
    await panel.finishCompression("ready-A");
    if (boundary === "clearAll") {
      panel.click("清空全部");
      panel.upload(["new-C"]);
      await panel.finishCompression("new-C");
    } else {
      panel.render({ draft: draft() });
    }
    panel.setPrompt("当前素材的指令");
    const previews = panel.previews();
    await panel.failCompression("failed-old-B");

    assert.deepEqual(panel.errors(), []);
    assert.deepEqual(panel.previews(), previews);
    assert.equal(panel.prompt(), "当前素材的指令");
  });
}

test("an old upload failure cannot overwrite a current validation error", async (t) => {
  const panel = harness(t);
  panel.upload(["old-A", "failed-old-B"]);
  await panel.finishCompression("old-A");
  panel.click("清空全部");
  panel.upload(["new-C"]);
  await panel.finishCompression("new-C");
  panel.click("参考修改");
  await panel.click("生成图片");
  assert.deepEqual(panel.errors(), ["参考修改至少需要选择一张参考图"]);
  await panel.failCompression("failed-old-B");

  assert.deepEqual(panel.errors(), ["参考修改至少需要选择一张参考图"]);
  assert.deepEqual(panel.submissions, []);
});

for (const outcome of ["success", "failure"] as const) {
  test(`compression ${outcome} after unmount never attempts a state update`, async (t) => {
    const panel = harness(t);
    panel.upload(["old-A"]);
    panel.unmount();
    if (outcome === "success") await panel.finishCompression("old-A");
    else await panel.failCompression("old-A");
    assert.equal(panel.writesAfterUnmount, 0);
    assert.deepEqual(panel.submissions, []);
  });
}

test("generation-completion clearing also invalidates unfinished uploads", async (t) => {
  const panel = harness(t);
  panel.upload(["old-A", "old-B"]);
  await panel.finishCompression("old-A");
  await panel.click("生成图片");
  panel.render({ generating: true });
  panel.render({ generating: false });
  assert.deepEqual(panel.previews(), []);
  panel.upload(["new-C"]);
  await panel.finishCompression("new-C");
  await panel.finishCompression("old-B");

  assert.deepEqual(panel.previews(), ["preview:new-C"]);
  await panel.click("生成图片");
  assert.deepEqual(panel.submissions[1]!.request, {
    mode: "per-image", items: [item("new-C", "生成这张图的变体", 0)],
  });
});

test("effect cleanup/setup replay rejects old work but permits subsequent uploads", async (t) => {
  const panel = harness(t);
  panel.upload(["old-A", "old-B"]);
  await panel.finishCompression("old-A");
  panel.replayEffects();
  panel.upload(["new-C"]);
  await panel.finishCompression("new-C");
  await panel.finishCompression("old-B");

  assert.deepEqual(panel.previews(), ["preview:old-A", "preview:new-C"]);
  assert.deepEqual(panel.errors(), []);
});

test("overlapping normal selections append all images without changing the selected prompt", async (t) => {
  const panel = harness(t);
  panel.upload(["A", "B"]);
  await panel.finishCompression("B");
  panel.setPrompt("B 的指令");
  panel.upload(["C"]);
  await panel.finishCompression("C");
  panel.click("选择图片 2");
  panel.setPrompt("C 的指令");
  await panel.finishCompression("A");

  assert.deepEqual(panel.previews(), ["preview:B", "preview:C", "preview:A"]);
  assert.equal(panel.button("选择图片 2").props["aria-pressed"], true);
  assert.equal(panel.prompt(), "C 的指令");
  panel.click("选择图片 3");
  assert.equal(panel.prompt(), "");
  panel.setPrompt("A 的指令");
  panel.click("选择图片 1");
  assert.equal(panel.prompt(), "B 的指令");
  await panel.click("生成图片");
  assert.deepEqual(panel.submissions[0]!.request, { mode: "per-image", items: [
    item("B", "B 的指令", 0), item("C", "C 的指令", 1), item("A", "A 的指令", 2),
  ] });
});

test("an unchanged draft and ordinary rerenders do not cancel a normal append", async (t) => {
  const restored = draft();
  const panel = harness(t, { draft: restored });
  panel.upload(["new-F"]);
  panel.render({ draft: restored });
  panel.setPrompt("更新草稿 D 的指令");
  await panel.finishCompression("new-F");
  assert.deepEqual(panel.previews(), ["preview:draft-D", "preview:draft-E", "preview:new-F"]);
  assert.equal(panel.prompt(), "更新草稿 D 的指令");
  panel.click("选择图片 3");
  assert.equal(panel.prompt(), "");
});

test("normal append preserves reference-mode target, references and batch count", async (t) => {
  const panel = harness(t);
  panel.upload(["A", "B"]);
  await panel.finishCompression("A");
  await panel.finishCompression("B");
  panel.click("选择图片 2");
  panel.click("参考修改");
  panel.click("设为参考");
  panel.setPrompt("让 B 参考 A 的光照");
  panel.click("3 张");
  panel.upload(["C"]);
  await panel.finishCompression("C");
  await panel.click("生成图片");

  assert.deepEqual(panel.submissions, [{
    kind: "batch",
    request: {
      mode: "reference",
      targetImage: "data:image/png;base64,B",
      targetIndex: 1,
      referenceImages: ["data:image/png;base64,A"],
      prompt: "让 B 参考 A 的光照",
    },
    size: "1024x1024",
    count: 3,
  }]);
});

test("concurrent completions still enforce the five-image limit", async (t) => {
  const panel = harness(t);
  panel.upload(["A", "B", "C", "D", "E"]);
  await panel.finishCompression("A");
  panel.upload(["F", "G"]);
  for (const name of ["B", "C", "D", "E", "F", "G"]) await panel.finishCompression(name);
  assert.deepEqual(panel.previews(), ["A", "B", "C", "D", "E"].map((name) => `preview:${name}`));
  await panel.click("生成图片");
  assert.deepEqual(panel.submissions[0]!.request, { mode: "per-image", items:
    ["A", "B", "C", "D", "E"].map((name, index) => item(name, "生成这张图的变体", index)),
  });
});

test("a current compression failure remains visible and the next upload can recover", async (t) => {
  const panel = harness(t);
  panel.upload(["bad-A"]);
  await panel.failCompression("bad-A");
  assert.deepEqual(panel.errors(), ["读取图片失败"]);
  assert.deepEqual(panel.previews(), []);
  panel.upload(["good-B"]);
  await panel.finishCompression("good-B");
  assert.deepEqual(panel.errors(), []);
  assert.deepEqual(panel.previews(), ["preview:good-B"]);
});

test("a current FileReader failure reports an error without starting compression", async (t) => {
  const panel = harness(t);
  const [reader] = panel.upload(["unreadable-A"], false);
  reader!.fail();
  await panel.flush();
  assert.deepEqual(panel.errors(), ["读取图片失败"]);
  assert.equal(panel.hasCompression("unreadable-A"), false);
  assert.deepEqual(panel.previews(), []);
});

for (const count of [1, 2, 3, 4, 5]) {
  test(`normal generation preserves count=${count} and the single/batch callback`, async (t) => {
    const panel = harness(t);
    panel.upload(["A"]);
    await panel.finishCompression("A");
    panel.click(`${count} 张`);
    await panel.click("生成图片");
    assert.equal(panel.submissions.length, 1);
    assert.equal(panel.submissions[0]!.count, count);
    assert.equal(panel.submissions[0]!.kind, count === 1 ? "single" : "batch");
    assert.deepEqual(panel.submissions[0]!.request, {
      mode: "per-image", items: [item("A", "生成这张图的变体", 0)],
    });
  });
}


test("account switch clears mounted uploads and rejects old compression", async (t) => {
  const env = sessionFixture({ pathname: "/" });
  t.after(() => env.dispose());
  env.mountAuth();
  env.authRequests[0].resolve(sessionUser("A"));
  await env.flush();
  const panel = harness(t, { draft: env.store.getState().imageToImageDraft });
  panel.upload(["A-ready", "A-pending"]);
  await panel.finishCompression("A-ready");
  panel.setPrompt("A private instructions");
  const refresh = env.auth().refresh();
  env.authRequests[1].resolve(sessionUser("B"));
  await refresh;
  await env.flush();
  assert.equal(env.auth().user?.id, "B");
  assert.equal(env.store.getState().imageToImageDraft.refs.length, 0);
  panel.render({ draft: env.store.getState().imageToImageDraft });
  await panel.finishCompression("A-pending");
  assert.deepEqual(panel.previews(), []);
  assert.equal(panel.prompt(), "");
  panel.upload(["B-new"]);
  await panel.finishCompression("B-new");
  assert.deepEqual(panel.previews(), ["preview:B-new"]);
});
