import assert from "node:assert/strict";
import test from "node:test";
import { resultAspectRatio } from "./result-aspect";

test("only uses valid image dimensions to size the preview", () => {
  assert.equal(resultAspectRatio("1536x1024"), 1.5);
  assert.equal(resultAspectRatio("1024x1536"), 1024 / 1536);
  assert.equal(resultAspectRatio("auto"), null);
  assert.equal(resultAspectRatio("0x1024"), null);
});
