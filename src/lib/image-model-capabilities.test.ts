import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GPT_IMAGE_SIZE_OPTIONS,
  GROK_ASPECT_RATIOS,
  GROK_IMAGE_SIZE_OPTIONS,
  SEEDREAM_IMAGE_SIZE_OPTIONS,
  getImageSizeOptions,
  grokAspectRatio,
  isGrokImageModel,
} from "./image-model-capabilities";

test("grok exposes exactly the seven aspect ratios grok2api accepts", () => {
  assert.deepEqual(
    [...GROK_ASPECT_RATIOS],
    ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
  );
  assert.equal(GROK_IMAGE_SIZE_OPTIONS.length, 7);
  assert.deepEqual(
    GROK_IMAGE_SIZE_OPTIONS.map((option) => grokAspectRatio(option.value)),
    [...GROK_ASPECT_RATIOS],
  );
});

test("grok size options are the measured upstream output sizes", () => {
  for (const option of GROK_IMAGE_SIZE_OPTIONS) {
    const [width, height] = option.value.split("x").map(Number) as [
      number,
      number,
    ];
    assert.ok(width > 0 && height > 0, option.value);
    // 这些尺寸还要能通过服务端 assertImageSize 的 2048 / 4194304 限制
    assert.ok(width <= 2048 && height <= 2048, option.value);
    assert.ok(width * height <= 4_194_304, option.value);
    assert.match(option.label, /^\d+:\d+ \(\d+×\d+\)$/);
  }
});

test("grok pixel sizes map to the nearest ratio without reciprocal swaps", () => {
  assert.equal(grokAspectRatio("960x960"), "1:1");
  assert.equal(grokAspectRatio("1024x1024"), "1:1");
  assert.equal(grokAspectRatio("1280x720"), "16:9");
  assert.equal(grokAspectRatio("1920x1080"), "16:9");
  assert.equal(grokAspectRatio("720x1280"), "9:16");
  assert.equal(grokAspectRatio("1080x1920"), "9:16");
  assert.equal(grokAspectRatio("1152x768"), "3:2");
  assert.equal(grokAspectRatio("768x1152"), "2:3");
  assert.equal(grokAspectRatio("1365x1024"), "4:3");
  assert.equal(grokAspectRatio("1024x1365"), "3:4");
});

test("unparsable sizes fall back to the square ratio", () => {
  assert.equal(grokAspectRatio(""), "1:1");
  assert.equal(grokAspectRatio("nonsense"), "1:1");
  assert.equal(grokAspectRatio("0x100"), "1:1");
});

test("grok image models are detected case-insensitively", () => {
  assert.equal(isGrokImageModel("grok-imagine-image"), true);
  assert.equal(isGrokImageModel("GROK-IMAGINE-IMAGE-2.0"), true);
  assert.equal(isGrokImageModel(" grok-2-image "), true);
  assert.equal(isGrokImageModel("gpt-image-2"), false);
  assert.equal(isGrokImageModel("seedream"), false);
});

test("the workbench size list follows the model family", () => {
  assert.equal(
    getImageSizeOptions("grok-imagine-image"),
    GROK_IMAGE_SIZE_OPTIONS,
  );
  assert.equal(
    getImageSizeOptions("grok-imagine-image-2.0"),
    GROK_IMAGE_SIZE_OPTIONS,
  );
  assert.equal(
    getImageSizeOptions("seedream"),
    SEEDREAM_IMAGE_SIZE_OPTIONS,
  );
  assert.equal(
    getImageSizeOptions("gpt-image-2.5-flare"),
    GPT_IMAGE_SIZE_OPTIONS,
  );
});

test("the size table lives in one place", () => {
  const utils = readFileSync(
    new URL("../components/ImageGen/imageUtils.ts", import.meta.url),
    "utf8",
  );
  assert.match(utils, /return getImageSizeOptions\(model\)/);
  assert.doesNotMatch(utils, /MODEL_SIZE_OPTIONS/);
});
