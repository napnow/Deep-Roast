import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyReversePrompt, generationCost } from "./image-workspace";

describe("image workspace", () => {
  it("computes and clamps generation cost", () => {
    assert.equal(generationCost(1, 5), 5);
    assert.equal(generationCost(4, 5), 20);
    assert.equal(generationCost(0, 5), 5);
    assert.equal(generationCost(99, 5), 25);
  });

  it("applies a reverse prompt without losing text settings", () => {
    const next = applyReversePrompt(
      { prompt: "old", size: "1024x1024", count: 3, stylePrompt: "cinematic" },
      "new prompt",
    );
    assert.deepEqual(next, {
      prompt: "new prompt",
      size: "1024x1024",
      count: 3,
      stylePrompt: "cinematic",
    });
  });
});
