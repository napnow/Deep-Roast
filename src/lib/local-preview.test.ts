import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLocalMobilePreview } from "./local-preview";

describe("local mobile preview", () => {
  it("only enables the preview query in development", () => {
    assert.equal(isLocalMobilePreview("?preview=mobile", "development"), true);
    assert.equal(isLocalMobilePreview("?preview=mobile", "production"), false);
    assert.equal(isLocalMobilePreview("?preview=desktop", "development"), false);
    assert.equal(isLocalMobilePreview("", "development"), false);
  });
});
