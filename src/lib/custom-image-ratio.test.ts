import assert from "node:assert/strict";
import test from "node:test";
import { ratioToImageSize, normalizeImageSizeSelection } from "./custom-image-ratio";

test("ratio dimensions preserve the exact reduced integer ratio", () => {
  assert.equal(ratioToImageSize("5", "4"), "1535x1228");
  assert.equal(ratioToImageSize("10", "8"), "1535x1228");
  assert.equal(ratioToImageSize("2", "3"), "1024x1536");
});

test("invalid and excessively narrow ratios are rejected", () => {
  for (const [w, h] of [["0", "1"], ["1.5", "2"], ["101", "1"], ["100", "1"], ["", "2"]]) {
    assert.equal(ratioToImageSize(w, h), null);
  }
});

test("custom sizes survive GPT selection but not unsupported model switching", () => {
  const options = [{ value: "1024x1024", label: "1:1" }];
  assert.equal(normalizeImageSizeSelection("1535x1228", "gpt-image-2.5-flare", options), "1535x1228");
  assert.equal(normalizeImageSizeSelection("1535x1228", "seedream", options), "1024x1024");
  assert.equal(normalizeImageSizeSelection("9999x1", "gpt-image-2", options), "1024x1024");
});
