import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CANVAS_LAYOUT_BYTES, parseCanvasLayout } from "./canvas-layout";

const imageId = "149e2eee-409f-4480-bba3-68da18847df7";
const textId = "249e2eee-409f-4480-bba3-68da18847df7";

test("accepts legacy image layouts without connection data", () => {
  assert.deepEqual(parseCanvasLayout({
    revision: 2,
    nodes: [{ id: imageId, x: 20, y: 30 }],
    hiddenIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }), {
    revision: 2,
    nodes: [{ id: imageId, x: 20, y: 30 }],
    connections: [],
    hiddenIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
});

test("persists text nodes and cross-node connections", () => {
  const parsed = parseCanvasLayout({
    revision: 3,
    nodes: [
      { id: imageId, kind: "image", x: 0, y: 0 },
      { id: textId, kind: "text", x: 340, y: 40, text: "雨夜霓虹街头" },
    ],
    connections: [{ id: "image-text", source: imageId, target: textId }],
    hiddenIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  assert.equal(parsed.nodes[1]?.kind, "text");
  assert.deepEqual(parsed.connections, [{ id: "image-text", source: imageId, target: textId }]);
});

test("rejects connections whose endpoints are not on the canvas", () => {
  assert.throws(() => parseCanvasLayout({
    revision: 3,
    nodes: [{ id: imageId, x: 0, y: 0 }],
    connections: [{ id: "missing", source: imageId, target: textId }],
    hiddenIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }), /connection/i);
});

test("accepts a full 500-node canvas with a dense manual connection graph", () => {
  const ids = Array.from({ length: 500 }, (_, index) =>
    `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  );
  const parsed = parseCanvasLayout({
    revision: 7,
    nodes: ids.map((id, index) => ({ id, kind: "image", x: index * 20, y: index * 10 })),
    connections: ids.slice(1).map((target, index) => ({
      id: `manual-${index}`,
      source: ids[index],
      target,
    })),
    hiddenIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  assert.equal(parsed.nodes.length, 500);
  assert.equal(parsed.connections.length, 499);
  assert.ok(new TextEncoder().encode(JSON.stringify(parsed)).byteLength < MAX_CANVAS_LAYOUT_BYTES);
});

test("rejects layouts whose total UTF-8 payload exceeds the shared transport budget", () => {
  const textNodes = Array.from({ length: 50 }, (_, index) => ({
    id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    kind: "text" as const,
    x: index,
    y: 0,
    text: "画".repeat(12_000),
  }));
  assert.throws(() => parseCanvasLayout({
    revision: 1,
    nodes: textNodes,
    connections: [],
    hiddenIds: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }), /too large/i);
});
