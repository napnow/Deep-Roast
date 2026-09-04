import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const mobileBar = readFileSync(
  new URL("./ImageMobileBar.tsx", import.meta.url),
  "utf8",
);
const reversePanel = readFileSync(
  new URL("./ReversePromptPanel.tsx", import.meta.url),
  "utf8",
);

describe("mobile creation shell", () => {
  it("uses a touch-friendly size picker instead of the browser select menu", () => {
    assert.match(mobileBar, /mobile-size-picker/);
    assert.match(mobileBar, /toolbarOpen === "size"/);
    assert.doesNotMatch(mobileBar, /<select[\s\S]*aria-label="图片比例"/);
  });

  it("makes the existing reverse prompt upload state into a compact mobile card", () => {
    assert.match(reversePanel, /reverse-mobile-upload-card/);
  });

  it("keeps the composer above the keyboard without locking the page on input focus", () => {
    assert.match(mobileBar, /keyboardInset/);
    assert.match(mobileBar, /keyboardOpen/);
    assert.match(mobileBar, /keyboardOpen\s*\?\s*"0px"/);
    assert.doesNotMatch(mobileBar, /onFocus=\{\(\) =>[\s\S]*lockPageScroll/);
    assert.doesNotMatch(mobileBar, /onBlur=\{unlockPageScroll\}/);
  });
});
