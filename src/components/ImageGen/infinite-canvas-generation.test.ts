import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("canvas integrates bounded generation status and queue controls", () => {
  const source = readFileSync(new URL("./InfiniteImageCanvas.tsx", import.meta.url), "utf8");
  assert.match(source, /createCanvasGenerationQueue/);
  assert.match(source, /CanvasGenerationQueueSummary/);
  assert.match(source, /CanvasGenerationStatus/);
  assert.match(source, /generationQueue\.cancel/);
  assert.match(source, /generationQueue\.retry/);
});

test("canvas callback receives a cancellation context", () => {
  const source = readFileSync(new URL("../../app/studio/canvas/page.tsx", import.meta.url), "utf8");
  assert.match(source, /CanvasGenerateContext/);
  assert.match(source, /signal: context\.signal/);
});
