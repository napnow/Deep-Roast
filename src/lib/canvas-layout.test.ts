import assert from "node:assert/strict";
import test from "node:test";
import { parseCanvasLayout } from "./canvas-layout";

const id = "149e2eee-409f-4480-bba3-68da18847df7";
const layout = { nodes: [{ id, x: -100, y: 200 }], hiddenIds: [], viewport: { x: 0, y: 5, zoom: 1 }, revision: 0 };
test("accepts bounded positions, viewport and revision", () => assert.deepEqual(parseCanvasLayout(layout), layout));
test("rejects duplicate image IDs, invalid numbers and oversized layouts", () => {
  assert.throws(() => parseCanvasLayout({ ...layout, nodes: [layout.nodes[0], layout.nodes[0]] }));
  assert.throws(() => parseCanvasLayout({ ...layout, nodes: [{ id, x: Infinity, y: 0 }] }));
  assert.throws(() => parseCanvasLayout({ ...layout, viewport: { x: 0, y: 0, zoom: 0 } }));
  assert.throws(() => parseCanvasLayout({ ...layout, revision: -1 }));
  assert.throws(() => parseCanvasLayout({ ...layout, nodes: Array(501).fill(layout.nodes[0]) }));
  assert.throws(() => parseCanvasLayout({ ...layout, nodes: [{ id: "not-a-uuid", x: 0, y: 0 }] }));
});


test("rejects an image that is both hidden and visible, or duplicate hidden IDs", () => {
  assert.throws(() => parseCanvasLayout({ ...layout, hiddenIds: [id] }));
  const hidden = "188e2eee-409f-4480-bba3-68da18847df7";
  assert.throws(() => parseCanvasLayout({ ...layout, hiddenIds: [hidden, hidden] }));
});
