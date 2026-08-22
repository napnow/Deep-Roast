import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/lib/client-api";
import { classifyImageTaskError } from "./image-task";

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
