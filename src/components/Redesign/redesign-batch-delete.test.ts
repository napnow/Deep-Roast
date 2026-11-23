import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("redesign gallery keeps batch delete wired to image actions", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  const studio = readFileSync("src/components/Redesign/RedesignStudio.tsx", "utf8");
  assert.match(page, /actions\.handleBatchDeleteImages\(ids, mode\)/);
  assert.match(page, /onBatchDeleteImages=\{handleBatchDeleteImages\}/);
  assert.match(studio, /onBatchDeleteImages\(ids, mode\)/);
  assert.match(studio, /batchDelete\("version-group"\)/);
  assert.match(studio, /batchDelete\("selected"\)/);
  assert.match(studio, /删除选中/);
  assert.match(studio, /删除版本组/);
  assert.match(studio, /useConfirm\(\)/);
});
