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
const resultCanvas = readFileSync(
  new URL("./ResultCanvas.tsx", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
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

  it("defaults to a compact two-state composer with click and swipe controls", () => {
    assert.match(mobileBar, /useState\(false\)/);
    assert.match(mobileBar, /mobile-composer-handle/);
    assert.match(mobileBar, /aria-expanded=\{expanded\}/);
    assert.match(mobileBar, /resolveMobileComposerDrag/);
    assert.match(mobileBar, /mobile-composer-expanded/);
    assert.match(mobileBar, /mobile-composer-compact/);
  });

  it("collapses the editor when generation starts and removes duplicate stop decoration", () => {
    assert.match(mobileBar, /if \(!generating\) return;[\s\S]*setExpanded\(false\)/);
    assert.doesNotMatch(mobileBar, /generating \? "■"/);
    assert.match(resultCanvas, /result-canvas-stop/);
    assert.match(
      globalStyles,
      /@media \(max-width: 767px\)[\s\S]*\.result-canvas-stop\s*\{\s*display:\s*none/,
    );
  });
});
