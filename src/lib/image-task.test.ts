import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/lib/client-api";
import {
  classifyImageTaskError,
  createImageTaskState,
  shouldReuseIdempotencyKey,
  type ImageTaskRequest,
} from "./image-task";

describe("image task errors", () => {
  it("classifies credit, service, and network failures", () => {
    const creditsErr = classifyImageTaskError(
      new ApiError("积分不足", 402, "INSUFFICIENT_CREDITS"),
    );
    assert.equal(creditsErr.kind, "credits");
    assert.equal(shouldReuseIdempotencyKey(creditsErr), false);

    const serviceErr = classifyImageTaskError(new ApiError("服务失败", 502));
    assert.equal(serviceErr.kind, "service");
    assert.equal(shouldReuseIdempotencyKey(serviceErr), false);

    const inProgressErr = classifyImageTaskError(
      new ApiError("相同幂等请求正在处理中，请稍后重试", 409, "IDEMPOTENCY_IN_PROGRESS"),
    );
    assert.equal(inProgressErr.kind, "service");
    assert.equal(inProgressErr.code, "IDEMPOTENCY_IN_PROGRESS");
    assert.equal(shouldReuseIdempotencyKey(inProgressErr), true);

    const staleErr = classifyImageTaskError(
      new ApiError("先前的同 ID 请求已超时，请使用新的请求 ID 重试", 409, "IDEMPOTENCY_STALE_REQUEST"),
    );
    assert.equal(shouldReuseIdempotencyKey(staleErr), false);

    const networkErr = classifyImageTaskError(new Error("offline"));
    assert.equal(networkErr.kind, "network");
    assert.equal(shouldReuseIdempotencyKey(networkErr), true);
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
