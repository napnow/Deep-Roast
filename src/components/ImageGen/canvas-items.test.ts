import test from "node:test";
import assert from "node:assert/strict";
import { mergeCanvasItems, canvasEdges, dedupeCanvasEdges, findLegacyAutoAddedCanvasIds, isAutoAddedGridPosition, mergeCanvasItemsNear, replaceCanvasPlaceholder } from "./canvas-items";

test("adds new images without replacing moved positions or duplicating nodes", () => {
  assert.deepEqual(mergeCanvasItems([{id:"a", x:45, y:-20}], ["a", "b", "b"]), [
    {id:"a", x:45, y:-20}, {id:"b", x:390, y:0},
  ]);
});

test("removes deleted records and handles an empty library", () => {
  assert.deepEqual(mergeCanvasItems([{id:"a", x:1, y:2}], []), []);
});

test("newest image is placed in an empty grid position when history is prepended", () => {
  const merged = mergeCanvasItems([{id:"a", x:0, y:0}], ["b", "a"]);
  assert.notDeepEqual({x:merged[0].x,y:merged[0].y}, {x:merged[1].x,y:merged[1].y});
});

test("only grid lattice coordinates count as auto-added positions", () => {
  assert.equal(isAutoAddedGridPosition(0, 0), true);
  assert.equal(isAutoAddedGridPosition(1170, 2580), true);
  assert.equal(isAutoAddedGridPosition(41, 0), false);
  assert.equal(isAutoAddedGridPosition(1560, 0), false);
  assert.equal(isAutoAddedGridPosition(0, -430), false);
});

test("drops a legacy grid dump while keeping the user's real nodes", () => {
  const gridIds = Array.from({ length: 19 }, (_, index) => `grid-${index}`);
  const real = [
    { id: "text-source", x: 1704.07, y: 1848.89 },
    { id: "hand-placed", x: -347.48, y: 1264.15 },
    { id: "linked-image", x: 2416.56, y: 1474.19 },
  ];
  const dropped = findLegacyAutoAddedCanvasIds([...mergeCanvasItems([], gridIds), ...real], ["text-source", "linked-image"]);
  assert.deepEqual([...dropped].sort(), [...gridIds].sort());
});

test("never touches a sparse hand-built layout", () => {
  assert.deepEqual(findLegacyAutoAddedCanvasIds([
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 390, y: 0 },
    { id: "c", x: -120, y: 96 },
  ], []), []);
  assert.deepEqual(findLegacyAutoAddedCanvasIds(mergeCanvasItems([], ["a", "b", "c", "d"]), ["a", "b", "c", "d"]), []);
});

test("drops a full legacy dump with no linked nodes", () => {
  const ids = Array.from({ length: 30 }, (_, index) => `grid-${index}`);
  assert.deepEqual(findLegacyAutoAddedCanvasIds(mergeCanvasItems([], ids), []), ids);
});

test("replaces a generated image into its placeholder position", () => {
  assert.deepEqual(replaceCanvasPlaceholder([{ id: "placeholder", x: 820, y: 240, placeholder: true }], "placeholder", "image"), [
    { id: "image", x: 820, y: 240 },
  ]);
});

test("places generated images near their source node", () => {
  const result = mergeCanvasItemsNear([{ id: "text", x: 100, y: 200 }], ["image"], "text");
  assert.deepEqual(result.find(item => item.id === "image"), { id: "image", x: 520, y: 200 });
});


test("draws only recorded ancestry between visible distinct images", () => {
  assert.deepEqual(canvasEdges([
    { id: "a" }, { id: "b", sourceImageId: "a" }, { id: "c", sourceImageId: "missing" },
    { id: "d", sourceImageId: "d" }, { id: "e", sourceImageId: null },
  ]), [{ id: "a->b", source: "a", target: "b" }]);
});

test("renders one edge when ancestry and a saved connection describe the same link", () => {
  assert.deepEqual(dedupeCanvasEdges([
    { id: "manual:a->b", source: "a", target: "b" },
    { id: "a->b", source: "a", target: "b" },
    { id: "b->c", source: "b", target: "c" },
  ]), [
    { id: "manual:a->b", source: "a", target: "b" },
    { id: "b->c", source: "b", target: "c" },
  ]);
});
