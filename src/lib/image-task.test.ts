import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/lib/client-api";
import {
  classifyImageTaskError,
  createImageTaskState,
  type ImageTaskRequest,
} from "./image-task";

describe("image task errors", () => {
  it("classifies credit, service, and network failures", () => {
    assert.equal(
      classifyImageTaskError(
        new ApiError("积分不足", 402, "INSUFFICIENT_CREDITS"),
      ).kind,
      "credits",
    );
    assert.equal(classifyImageTaskError(new ApiError("服务失败", 502)).kind, "service");
    assert.equal(classifyImageTaskError(new Error("offline")).kind, "network");
  });
});

describe("image task request state", () => {
  it("keeps a structured reference edit request for retry", () => {
    const editRequest: NonNullable<ImageTaskRequest["editRequest"]> = {
      mode: "reference",
      targetImage: "target",
      targetIndex: 0,
      referenceImages: ["ref"],
      prompt: "参考",
    };
    const state = createImageTaskState({
      mode: "edit",
      prompt: "参考",
      size: "1024x1024",
      count: 1,
      editRequest,
    });

    assert.deepEqual(state.request?.editRequest, editRequest);
    assert.equal(state.status, "generating");
  });
});
