import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildImageEditRequest } from "./image-edit-ui";

describe("image edit UI request builder", () => {
  it("builds independent tasks with per-image prompt fallback", () => {
    assert.deepEqual(
      buildImageEditRequest(
        ["a", "b"],
        { mode: "per-image", prompts: ["改一", ""] },
        "统一修改",
      ),
      {
        mode: "per-image",
        items: [
          { image: "a", prompt: "改一", targetIndex: 0 },
          { image: "b", prompt: "统一修改", targetIndex: 1 },
        ],
      },
    );
  });

  it("builds a target/reference request without the target in references", () => {
    assert.deepEqual(
      buildImageEditRequest(
        ["target", "ref"],
        { mode: "reference", targetIndex: 0, referenceIndexes: [0, 1] },
        "参考风格",
      ),
      {
        mode: "reference",
        targetImage: "target",
        targetIndex: 0,
        referenceImages: ["ref"],
        prompt: "参考风格",
      },
    );
  });

  it("drops reference indexes that no longer exist", () => {
    assert.deepEqual(
      buildImageEditRequest(
        ["a"],
        { mode: "reference", targetIndex: 2, referenceIndexes: [0, 4] },
        "",
      ),
      {
        mode: "reference",
        targetImage: "a",
        targetIndex: 0,
        referenceImages: [],
        prompt: "",
      },
    );
  });
});
