import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { executeImageEditTasks } from "./image-edit-runner";
import type { ImageEditTask } from "@/lib/image-edit-contract";
import { ApiError } from "@/server/http";

type Output = {
  id: string;
  prompt: string;
};

describe("image edit task runner", () => {
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
