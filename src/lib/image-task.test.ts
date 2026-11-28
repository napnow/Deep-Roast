import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/lib/client-api";
import { mapImageSizeToModelOption } from "@/lib/image-model-capabilities";
import {
  classifyImageTaskError,
  createImageTaskState,
  shouldReuseIdempotencyKey,
  type ImageTaskRequest,
} from "./image-task";

describe("image task errors", () => {
  it("classifies credit, service, rate-limit, gateway, and network failures", () => {
    const creditsErr = classifyImageTaskError(
      new ApiError("积分不足", 402, "INSUFFICIENT_CREDITS", { error: "积分不足" }),
    );
    assert.equal(creditsErr.kind, "credits");
    assert.equal(shouldReuseIdempotencyKey(creditsErr), false);

    const serviceErr = classifyImageTaskError(
      new ApiError("服务失败", 502, "UPSTREAM_IMAGE_ERROR", { error: "服务失败" }),
    );
    assert.equal(serviceErr.kind, "service");
    assert.equal(shouldReuseIdempotencyKey(serviceErr), false);
    assert.equal(shouldReuseIdempotencyKey(serviceErr, true), false);

    const inProgressErr = classifyImageTaskError(
      new ApiError("相同幂等请求正在处理中，请稍后重试", 409, "IDEMPOTENCY_IN_PROGRESS", { error: "in_progress" }),
    );
    assert.equal(inProgressErr.kind, "service");
    assert.equal(inProgressErr.code, "IDEMPOTENCY_IN_PROGRESS");
    assert.equal(shouldReuseIdempotencyKey(inProgressErr), true);

    const rateLimitErr = classifyImageTaskError(
      new ApiError("请求过于频繁，请稍后再试", 429, "RATE_LIMITED", { error: "rate_limited" }),
    );
    assert.equal(shouldReuseIdempotencyKey(rateLimitErr), true);
    assert.equal(shouldReuseIdempotencyKey(rateLimitErr, true), true);

    const htmlGatewayErr = classifyImageTaskError(
      new ApiError("请求失败 (504)", 504, undefined, null),
    );
    assert.equal(htmlGatewayErr.unsettledGateway, true);
    assert.equal(shouldReuseIdempotencyKey(htmlGatewayErr), true);

    const queueFullErr = classifyImageTaskError(
      new ApiError("生图任务较多", 503, "IMAGE_QUEUE_FULL", { error: "busy" }),
    );
    assert.equal(shouldReuseIdempotencyKey(queueFullErr, false), false);
    assert.equal(shouldReuseIdempotencyKey(queueFullErr, true), true);

    const staleErr = classifyImageTaskError(
      new ApiError("先前的同 ID 请求已超时，请使用新的请求 ID 重试", 409, "IDEMPOTENCY_STALE_REQUEST", { error: "stale" }),
    );
    assert.equal(shouldReuseIdempotencyKey(staleErr), false);
    assert.equal(shouldReuseIdempotencyKey(staleErr, true), false);

    const networkErr = classifyImageTaskError(new Error("offline"));
    assert.equal(networkErr.kind, "network");
    assert.equal(shouldReuseIdempotencyKey(networkErr), true);
  });

  it("maps cross-model Gemini 1K and 2K sizes onto matching GPT and Grok presets", () => {
    assert.equal(mapImageSizeToModelOption("1376x768", "gpt-image-2"), "1920x1080");
    assert.equal(mapImageSizeToModelOption("2752x1536", "gpt-image-2"), "1920x1080");
    assert.equal(mapImageSizeToModelOption("1792x2400", "gpt-image-2"), "1080x1440");
    assert.equal(mapImageSizeToModelOption("2048x2048", "gpt-image-2"), "1024x1024");
    assert.equal(mapImageSizeToModelOption("1376x768", "grok-imagine-1.0"), "1280x720");
    assert.equal(mapImageSizeToModelOption("1200x600", "gpt-image-2"), "1200x600");
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
