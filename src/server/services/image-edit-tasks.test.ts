import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateImageEditCost,
  normalizeImageEditRequest,
} from "./image-edit-tasks";

describe("image edit task normalization", () => {
  it("normalizes the legacy multi-image request into independent tasks", () => {
    const tasks = normalizeImageEditRequest(
      { image: ["a", "b"], prompt: "换背景" },
      "gpt-image-2",
    );
    assert.deepEqual(tasks, [
      {
        mode: "per-image",
        targetImage: "a",
        prompt: "换背景",
        targetIndex: 0,
      },
      {
        mode: "per-image",
        targetImage: "b",
        prompt: "换背景",
        targetIndex: 1,
      },
    ]);
  });

  it("keeps one target and one or more references for reference mode", () => {
    const tasks = normalizeImageEditRequest(
      {
        mode: "reference",
        targetImage: "target",
        referenceImages: ["ref-a", "ref-b"],
        prompt: "参考风格修改",
      },
      "gpt-image-2",
    );
    assert.deepEqual(tasks[0], {
      mode: "reference",
      targetImage: "target",
      referenceImages: ["ref-a", "ref-b"],
      prompt: "参考风格修改",
      targetIndex: 0,
    });
  });

  it("rejects self-reference and unsupported reference models", () => {
    assert.throws(
      () =>
        normalizeImageEditRequest(
          {
            mode: "reference",
            targetImage: "same",
            referenceImages: ["same"],
            prompt: "修改",
          },
          "gpt-image-2",
        ),
      /不能作为参考图/,
    );
    assert.throws(
      () =>
        normalizeImageEditRequest(
          {
            mode: "reference",
            targetImage: "target",
            referenceImages: ["ref"],
            prompt: "修改",
          },
          "grok-imagine-image-lite",
        ),
      /GPT Image 2/,
    );
  });

  it("charges per task rather than per reference image", () => {
    const tasks = normalizeImageEditRequest(
      {
        mode: "reference",
        targetImage: "target",
        referenceImages: ["ref-a", "ref-b"],
        prompt: "修改",
      },
      "gpt-image-2",
    );
    assert.equal(calculateImageEditCost(tasks, 3), 3);
  });
});
