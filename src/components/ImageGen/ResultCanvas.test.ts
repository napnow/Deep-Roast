import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("./ResultCanvas.tsx", import.meta.url), "utf8");

test("idle result state does not render the decorative center glyph", () => {
  assert.doesNotMatch(source, /result-idle-glyph/);
  assert.doesNotMatch(source, />焙<|>焙<\/span>/);
  assert.match(source, /创作舞台已就绪/);
});
