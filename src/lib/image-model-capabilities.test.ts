import assert from "node:assert/strict";
import test from "node:test";

import {
  getImageSizeOptions,
  isGptImageModel,
  GPT_IMAGE_SIZE_OPTIONS,
} from "./image-model-capabilities";

test("all gpt-image-2 minor versions use the GPT exact-size workflow", () => {
  for (const model of [
    "gpt-image-2",
    "gpt-image-2.5-flare",
    "gpt-image-2.5-sunburst",
    "gpt-image-2.6-flare",
    "gpt-image-2.6-sunburst",
    "gpt-image-2.7",
  ]) {
    assert.equal(isGptImageModel(model), true, model);
  }
});

test("non GPT image models are not treated as crop models", () => {
  for (const model of [
    "gpt-image-1",
    "gpt-image-20",
    "gpt-6",
    "seedream-4",
    "grok-imagine",
    "gemini-3.1-flash-image-2k",
  ]) {
    assert.equal(isGptImageModel(model), false, model);
  }
});

test("image 2.6 models expose the GPT ratio presets", () => {
  assert.deepEqual(getImageSizeOptions("gpt-image-2.6-flare"), GPT_IMAGE_SIZE_OPTIONS);
  assert.deepEqual(getImageSizeOptions("gpt-image-2.6-sunburst"), GPT_IMAGE_SIZE_OPTIONS);
});
