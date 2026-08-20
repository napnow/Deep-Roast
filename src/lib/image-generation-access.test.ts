import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canUseImageGeneration } from "./image-generation-access";

describe("image generation UI availability", () => {
  it("blocks ordinary users and keeps administrators available", () => {
    assert.equal(canUseImageGeneration("user", false), false);
    assert.equal(canUseImageGeneration("admin", false), true);
  });

  it("allows ordinary users while the switch is enabled", () => {
    assert.equal(canUseImageGeneration("user", true), true);
  });
});
