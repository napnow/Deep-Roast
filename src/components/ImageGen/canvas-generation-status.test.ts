import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("generation status reuses staged indicator and exposes cancellation", () => {
  const source = readFileSync(new URL("./CanvasGenerationStatus.tsx", import.meta.url), "utf8");
  assert.match(source, /ImageGenStageIndicator/);
  assert.match(source, /formatTime/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /停止生成/);
});

test("queue summary exposes queued and active counts", () => {
  const source = readFileSync(new URL("./CanvasGenerationQueueSummary.tsx", import.meta.url), "utf8");
  assert.match(source, /正在生成/);
  assert.match(source, /排队/);
  assert.match(source, /role="status"/);
});
