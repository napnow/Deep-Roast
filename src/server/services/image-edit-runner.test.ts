import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeImageEditTasks, largeOrUnknownReferences } from "./image-edit-runner";
import type { ImageEditTask } from "@/lib/image-edit-contract";
import { ApiError } from "@/server/http";

type Output = {
  id: string;
  prompt: string;
};

describe("image edit task runner", () => {
  it("preserves the safe busy message and code if all operations are rejected", async () => {
    const tasks: ImageEditTask[] = [{ mode: "per-image", targetImage: "a", prompt: "edit", targetIndex: 0 }];
    const result = await executeImageEditTasks(tasks, 2, async () => { throw new ApiError("生图任务较多，请稍后重试", 503, "IMAGE_QUEUE_FULL"); });
    assert.equal(result.failed, 2);
    assert.equal(result.lastError, "生图任务较多，请稍后重试");
    assert.equal(result.queueFull, true);
  });
  it("treats whitespace-padded remote and stored images as unknown size", () => {
    assert.equal(largeOrUnknownReferences(["  https://example.test/picture.png  "]), true);
    assert.equal(largeOrUnknownReferences(["  /api/images/picture.png  "]), true);
  });
  it("runs large reference payloads one at a time to reduce memory pressure", async () => {
    const tasks: ImageEditTask[] = [{ mode: "per-image", targetImage: "data:image/png;base64," + "a".repeat(5 * 1024 * 1024), prompt: "edit", targetIndex: 0 }];
    const gates: Array<() => void> = [];
    let started = 0;
    const run = executeImageEditTasks(tasks, 2, async () => { started++; await new Promise<void>((resolve) => gates.push(resolve)); return "ok"; });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(started, 1);
    gates[0]!(); await new Promise((resolve) => setImmediate(resolve));
    assert.equal(started, 2);
    gates[1]!(); await run;
  });
  it("does not start further edits after cancellation", async () => {
    const tasks: ImageEditTask[] = [0, 1, 2].map((i) => ({ mode: "per-image", targetImage: String(i), prompt: "edit", targetIndex: i }));
    const controller = new AbortController();
    const gates: Array<() => void> = [];
    let started = 0;
    const run = executeImageEditTasks(tasks, 1, async () => {
      started++; await new Promise<void>((resolve) => gates.push(resolve)); return "ok";
    }, controller.signal);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(started, 2);
    controller.abort(); gates[0]!(); gates[1]!();
    const result = await run;
    assert.equal(started, 2);
    assert.equal(result.succeeded, 2);
    assert.equal(result.failed, 1);
  });
  it("runs at most two edits in parallel and returns results in task order", async () => {
    const tasks: ImageEditTask[] = [0, 1, 2].map((i) => ({ mode: "per-image", targetImage: String(i), prompt: "edit", targetIndex: i }));
    let active = 0, peak = 0;
    const gates: Array<() => void> = [];
    const run = executeImageEditTasks(tasks, 1, async (task) => {
      active++; peak = Math.max(peak, active);
      await new Promise<void>((resolve) => gates.push(resolve));
      active--;
      return task.targetImage;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(active, 2);
    gates[1]!();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(active, 2);
    gates[0]!(); gates[2]!();
    const result = await run;
    assert.equal(peak, 2);
    assert.deepEqual(result.images.map((entry) => entry.result), ["0", "1", "2"]);
  });
  it("sends only the target image for per-image tasks", async () => {
    const calls: Array<string | string[]> = [];
    const tasks: ImageEditTask[] = [
      {
        mode: "per-image",
        targetImage: "a",
        prompt: "改一",
        targetIndex: 0,
      },
      {
        mode: "per-image",
        targetImage: "b",
        prompt: "改二",
        targetIndex: 1,
      },
    ];

    const result = await executeImageEditTasks<Output>(
      tasks,
      1,
      async (task) => {
        const input =
          task.mode === "reference"
            ? [task.targetImage, ...task.referenceImages]
            : task.targetImage;
        calls.push(input);
        return { id: task.targetImage, prompt: task.prompt };
      },
    );

    assert.deepEqual(calls, ["a", "b"]);
    assert.deepEqual(
      result.images.map((item) => [item.result.id, item.taskIndex, item.targetIndex]),
      [
        ["a", 0, 0],
        ["b", 1, 1],
      ],
    );
  });

  it("sends target first and references together", async () => {
    const calls: Array<string | string[]> = [];
    const tasks: ImageEditTask[] = [
      {
        mode: "reference",
        targetImage: "target",
        referenceImages: ["ref-a", "ref-b"],
        prompt: "参考",
        targetIndex: 0,
      },
    ];

    await executeImageEditTasks<Output>(
      tasks,
      2,
      async (task) => {
        const input =
          task.mode === "reference"
            ? [task.targetImage, ...task.referenceImages]
            : task.targetImage;
        calls.push(input);
        return { id: "result", prompt: task.prompt };
      },
    );

    assert.deepEqual(calls, [
      ["target", "ref-a", "ref-b"],
      ["target", "ref-a", "ref-b"],
    ]);
  });

  it("passes stable attempt indexes and hides upstream server errors", async () => {
    const calls: Array<[number, number]> = [];
    const tasks: ImageEditTask[] = [
      {
        mode: "per-image",
        targetImage: "target",
        prompt: "edit",
        targetIndex: 0,
      },
    ];

    const result = await executeImageEditTasks(
      tasks,
      2,
      async (_task, taskIndex, variantIndex) => {
        calls.push([taskIndex, variantIndex]);
        throw new ApiError("upstream leaked details", 502);
      },
    );

    assert.deepEqual(calls, [
      [0, 0],
      [0, 1],
    ]);
    assert.equal(result.lastError, "图生图失败，请稍后重试");
  });
});
