import { strict as assert } from "node:assert";
import { test } from "node:test";
import { getViewportOcclusion } from "./mobile-viewport-metrics";

test("accounts for keyboard overlap only when the layout viewport has not already resized", () => {
  assert.equal(getViewportOcclusion(800, 500, 0), 300);
  assert.equal(getViewportOcclusion(500, 500, 0), 0);
  assert.equal(getViewportOcclusion(800, 500, 30), 270);
  assert.equal(getViewportOcclusion(500, 510, 0), 0);
});
