import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("mobile viewport derives keyboard state from VisualViewport", () => {
  const hookPath = "src/hooks/useMobileViewport.ts";
  assert.equal(existsSync(hookPath), true, "mobile viewport hook must exist");

  const source = readFileSync(hookPath, "utf8");
  assert.match(source, /window\.visualViewport/);
  assert.match(source, /keyboardInset/);
  assert.match(source, /keyboardOpen/);
  assert.match(source, /KEYBOARD_OPEN_THRESHOLD\s*=\s*120/);
  assert.match(source, /keyboardInset\s*>\s*KEYBOARD_OPEN_THRESHOLD/);
});
