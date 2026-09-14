import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOBILE_COMPOSER_DRAG_THRESHOLD,
  resolveMobileComposerDrag,
} from "./mobile-composer-state";

describe("mobile composer drag state", () => {
  it("expands on an upward drag at the threshold", () => {
    assert.equal(resolveMobileComposerDrag(200, 164, false), true);
  });

  it("collapses on a downward drag at the threshold", () => {
    assert.equal(resolveMobileComposerDrag(100, 136, true), false);
  });

  it("keeps the current state for small movements", () => {
    assert.equal(resolveMobileComposerDrag(100, 99, false), false);
    assert.equal(resolveMobileComposerDrag(100, 101, true), true);
    assert.equal(MOBILE_COMPOSER_DRAG_THRESHOLD, 36);
  });
});
