import assert from "node:assert/strict";
import test from "node:test";

import {
  GEMINI_IMAGE_1K_SIZE_OPTIONS,
  GEMINI_IMAGE_2K_SIZE_OPTIONS,
  GEMINI_IMAGE_MODEL_1K,
  GEMINI_IMAGE_MODEL_2K,
  GPT_IMAGE_SIZE_OPTIONS,
  geminiAspectRatio,
  geminiImageSize,
  getImageSizeOptions,
  isGeminiImageModel,
  isGptImageModel,
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

test("gemini image models expose 1K and 2K ratio presets and map ratios accurately", () => {
  assert.equal(isGeminiImageModel(GEMINI_IMAGE_MODEL_1K), true);
  assert.equal(isGeminiImageModel(GEMINI_IMAGE_MODEL_2K), true);
  assert.equal(isGeminiImageModel("gemini-3.1-flash-image"), false);
  assert.equal(geminiImageSize(GEMINI_IMAGE_MODEL_1K), "1K");
  assert.equal(geminiImageSize(GEMINI_IMAGE_MODEL_2K), "2K");
  assert.deepEqual(getImageSizeOptions(GEMINI_IMAGE_MODEL_1K), GEMINI_IMAGE_1K_SIZE_OPTIONS);
  assert.deepEqual(getImageSizeOptions(GEMINI_IMAGE_MODEL_2K), GEMINI_IMAGE_2K_SIZE_OPTIONS);
  assert.equal(geminiAspectRatio("1024x1024"), "1:1");
  assert.equal(geminiAspectRatio("1376x768"), "16:9");
  assert.equal(geminiAspectRatio("768x1376"), "9:16");
  assert.equal(geminiAspectRatio("2400x1792"), "4:3");
  assert.equal(geminiAspectRatio("1792x2400"), "3:4");
});
