import test from "node:test";
import assert from "node:assert/strict";
import { mergeCanvasItems, canvasEdges, dedupeCanvasEdges, findLegacyAutoAddedCanvasIds, isAutoAddedGridPosition, mergeCanvasItemsNear, placeCanvasAdditions, replaceCanvasPlaceholder, replacePlaceholderConnections } from "./canvas-items";

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

test("keeps a generated chain node within the next column when nodes do not overlap", () => {
  const result = mergeCanvasItemsNear([
    { id: "source", x: 0, y: 0 },
    { id: "existing", x: 756, y: 232 },
  ], ["image"], "source");
  assert.deepEqual(result.find(item => item.id === "image"), { id: "image", x: 420, y: 0 });
});

test("keeps existing nodes when an addition carries no placement hint", () => {
  const result = placeCanvasAdditions([{ id: "source", x: 100, y: 200 }, { id: "downstream", x: 520, y: 200 }], ["fresh"]);
  assert.deepEqual(result.map(item => item.id).sort(), ["downstream", "fresh", "source"]);
  assert.deepEqual(result.find(item => item.id === "source"), { id: "source", x: 100, y: 200 });
  assert.deepEqual(result.find(item => item.id === "downstream"), { id: "downstream", x: 520, y: 200 });
});

test("fills the placeholder in place while keeping its siblings", () => {
  const result = placeCanvasAdditions(
    [{ id: "source", x: 100, y: 200 }, { id: "placeholder", x: 520, y: 200, placeholder: true }],
    ["image"],
    { placeholders: new Map([["image", "placeholder"]]) },
  );
  assert.deepEqual(result, [{ id: "source", x: 100, y: 200 }, { id: "image", x: 520, y: 200 }]);
});

test("lays a generated image beside its anchor without dropping the chain", () => {
  const result = placeCanvasAdditions(
    [{ id: "source", x: 100, y: 200 }, { id: "downstream", x: 940, y: 200 }],
    ["image"],
    { anchors: new Map([["image", "source"]]) },
  );
  assert.deepEqual(result.find(item => item.id === "image"), { id: "image", x: 520, y: 200 });
  assert.deepEqual(result.map(item => item.id).sort(), ["downstream", "image", "source"]);
});

test("places a generated image beside a text anchor supplied separately", () => {
  const result = placeCanvasAdditions(
    [{ id: "image", x: 0, y: 430 }],
    ["generated"],
    { anchors: new Map([["generated", "text"]]) },
    [{ id: "text", x: 100, y: 200 }],
  );
  assert.deepEqual(result, [
    { id: "image", x: 0, y: 430 },
    { id: "generated", x: 520, y: 200 },
  ]);
});

test("re-running the same update keeps the chain instead of collapsing to the new node", () => {
  const start = [{ id: "text", x: 80, y: 100 }, { id: "source", x: 100, y: 200 }, { id: "placeholder", x: 940, y: 200, placeholder: true }];
  const once = placeCanvasAdditions(start, ["image"], { anchors: new Map([["image", "source"]]) });
  // React may invoke a state updater again after the hints were already consumed.
  const twice = placeCanvasAdditions(once, ["image"], { anchors: new Map([["image", "source"]]) });
  const afterConsumed = placeCanvasAdditions(once, ["image"]);
  for (const layout of [once, twice, afterConsumed]) {
    assert.deepEqual(layout.map(item => item.id).sort(), ["image", "placeholder", "source", "text"]);
    assert.deepEqual(layout.find(item => item.id === "image"), { id: "image", x: 520, y: 200 });
  }
});

test("contains a placeholder already filled by an earlier pass", () => {
  const filled = placeCanvasAdditions(
    [{ id: "source", x: 100, y: 200 }, { id: "placeholder", x: 520, y: 200, placeholder: true }],
    ["image"],
    { placeholders: new Map([["image", "placeholder"]]) },
  );
  assert.deepEqual(placeCanvasAdditions(filled, ["image"], { placeholders: new Map([["image", "placeholder"]]) }), filled);
});

test("moves an already placed image when its anchor hint arrives late", () => {
  const result = placeCanvasAdditions(
    [{ id: "source", x: 100, y: 200 }, { id: "image", x: 0, y: 430 }],
    ["image"],
    { anchors: new Map([["image", "source"]]) },
  );
  assert.deepEqual(result, [{ id: "source", x: 100, y: 200 }, { id: "image", x: 520, y: 200 }]);
});

test("fills the placeholder when a library update places the image first", () => {
  const result = placeCanvasAdditions(
    [{ id: "source", x: 100, y: 200 }, { id: "placeholder", x: 520, y: 200, placeholder: true }, { id: "image", x: 0, y: 430 }],
    ["image"],
    { placeholders: new Map([["image", "placeholder"]]) },
  );
  assert.deepEqual(result, [{ id: "source", x: 100, y: 200 }, { id: "image", x: 520, y: 200 }]);
});

test("removes incoming placeholder edges and retargets outgoing edges", () => {
  assert.deepEqual(replacePlaceholderConnections([
    { id: "source-to-placeholder", source: "source", target: "placeholder" },
    { id: "placeholder-to-downstream", source: "placeholder", target: "downstream" },
    { id: "unrelated", source: "a", target: "b" },
  ], "placeholder", "generated"), [
    { id: "placeholder-to-downstream", source: "generated", target: "downstream" },
    { id: "unrelated", source: "a", target: "b" },
  ]);
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
