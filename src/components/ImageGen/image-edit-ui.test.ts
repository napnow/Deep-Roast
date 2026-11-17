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
        {
          mode: "reference",
          targetIndex: 0,
          prompt: "描述参考修改",
          referenceIndexes: [0, 1],
        },
        "参考风格",
      ),
      {
        mode: "reference",
        targetImage: "target",
        targetIndex: 0,
        referenceImages: ["ref"],
        prompt: "描述参考修改",
      },
    );
  });

  it("drops reference indexes that no longer exist", () => {
    assert.deepEqual(
      buildImageEditRequest(
        ["a"],
        {
          mode: "reference",
          targetIndex: 2,
          prompt: "",
          referenceIndexes: [0, 4],
        },
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


it("associates source IDs with actual edit targets after changing selection", () => {
  const refs = [
    { preview: "a", base64: "a", sourceImageId: "source-a" },
    { preview: "b", base64: "b", sourceImageId: "source-b" },
    { preview: "upload", base64: "upload" },
  ];
  assert.deepEqual(buildImageEditRequest(["a", "b", "upload"], { mode: "per-image", prompts: [] }, "edit", refs).items?.map(item => item.sourceImageId), ["source-a", "source-b", undefined]);
  assert.equal(buildImageEditRequest(["a", "b", "upload"], { mode: "reference", targetIndex: 1, prompt: "edit", referenceIndexes: [0] }, "", refs).sourceImageId, "source-b");
  assert.equal(buildImageEditRequest(["a", "b", "upload"], { mode: "reference", targetIndex: 2, prompt: "edit", referenceIndexes: [0] }, "", refs).sourceImageId, undefined);
  assert.equal(buildImageEditRequest(["changed"], { mode: "per-image", prompts: [] }, "edit", [refs[0]!]).items?.[0]?.sourceImageId, undefined);
});
