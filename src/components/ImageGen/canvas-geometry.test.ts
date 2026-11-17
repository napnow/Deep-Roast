import assert from "node:assert/strict";
import test from "node:test";
import { screenToCanvas, zoomAtPoint } from "./canvas-geometry";

test("zoom keeps the canvas point under the cursor stationary", () => {
  const viewport = { x: 70, y: -30, zoom: 1.5 };
  const pointer = { x: 400, y: 220 };
  const before = screenToCanvas(pointer, viewport);
  const after = zoomAtPoint(viewport, pointer, 2.5);
  assert.deepEqual(screenToCanvas(pointer, after), before);
});

test("zoom clamps to supported limits without moving its anchor", () => {
  const viewport = { x: 0, y: 0, zoom: 1 };
  const pointer = { x: 100, y: 50 };
  const after = zoomAtPoint(viewport, pointer, 100);
  assert.equal(after.zoom, 3);
  assert.deepEqual(screenToCanvas(pointer, after), pointer);
  assert.equal(zoomAtPoint(viewport, pointer, -5).zoom, 0.25);
});

test("converts positions at negative coordinates", () => {
  assert.deepEqual(screenToCanvas({ x: -40, y: 10 }, { x: 20, y: 30, zoom: 2 }), { x: -30, y: -10 });
});
