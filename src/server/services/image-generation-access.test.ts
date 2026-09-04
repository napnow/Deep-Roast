import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import {
  assertImageGenerationPolicy,
  canUseImageGeneration,
} from "./image-generation-access";

describe("image generation access policy", () => {
  it("allows ordinary users while the switch is enabled", () => {
    assert.equal(canUseImageGeneration("user", true), true);
  });

  it("blocks ordinary users with the stable API error while disabled", () => {
    assert.equal(canUseImageGeneration("user", false), false);
    assert.throws(
      () => assertImageGenerationPolicy("user", false),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        error.code === "IMAGE_GENERATION_DISABLED" &&
        error.message === "生图功能暂时关闭",
    );
  });

  it("keeps administrators enabled while the global switch is disabled", () => {
    assert.equal(canUseImageGeneration("admin", false), true);
    assert.doesNotThrow(() => assertImageGenerationPolicy("admin", false));
  });

  it("treats every non-admin role as an ordinary user", () => {
    assert.equal(canUseImageGeneration("api", false), false);
    assert.equal(canUseImageGeneration("", false), false);
  });
});
