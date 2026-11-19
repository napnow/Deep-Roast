import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("asset inspector exposes explicit selected and version-group deletion actions", () => {
  const source = readFileSync("src/components/ImageGen/AssetInspector.tsx", "utf8");
  assert.match(source, /删除选中/);
  assert.match(source, /删除版本组/);
  assert.match(source, /onBatchDelete/);
});

test("mobile gallery exposes the same deletion choices", () => {
  const source = readFileSync("src/components/ImageGen/GalleryTab.tsx", "utf8");
  assert.match(source, /删除选中/);
  assert.match(source, /删除版本组/);
  assert.match(source, /aria-pressed/);
});
