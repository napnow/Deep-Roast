import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("./ResultCanvas.tsx", import.meta.url), "utf8");
const styles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

test("idle result state does not render the decorative center glyph", () => {
  assert.doesNotMatch(source, /result-idle-glyph/);
  assert.doesNotMatch(source, />焙<|>焙<\/span>/);
  assert.match(source, /创作舞台已就绪/);
});

test("expanded prompt gets a full-width row before result actions", () => {
  assert.match(source, /result-card-footer.*is-expanded/);
  assert.match(source, /className="result-card-copy"/);
  assert.match(
    styles,
    /\.result-card-footer\.is-expanded \.result-card-copy \{[^}]*flex-basis: 100%;/,
  );
  assert.match(
    styles,
    /\.result-card-footer\.is-expanded \.result-actions \{[^}]*margin-left: auto;/,
  );
});
