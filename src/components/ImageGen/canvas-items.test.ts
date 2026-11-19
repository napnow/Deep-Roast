import test from "node:test";
import assert from "node:assert/strict";
import { mergeCanvasItems, canvasEdges, dedupeCanvasEdges } from "./canvas-items";

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
