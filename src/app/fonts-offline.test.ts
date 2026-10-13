import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";

test("production fonts are self-hosted without changing their bytes", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.match(layout, /fonts\.css/);
  assert.equal(existsSync("public/fonts/manifest.json"), true);
  const manifest = JSON.parse(readFileSync("public/fonts/manifest.json", "utf8")) as { files: Record<string, { sha256: string; preload: boolean }> };
  assert.equal(Object.keys(manifest.files).length, 12);
  assert.equal(Object.values(manifest.files).filter((file) => file.preload).length, 3);
  for (const [name, metadata] of Object.entries(manifest.files)) {
    const bytes = readFileSync(`public/fonts/${name}`);
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), metadata.sha256);
  }
  const css = readFileSync("src/app/fonts.css", "utf8");
  assert.doesNotMatch(css, /https?:\/\//);
  assert.match(css, /Fraunces Fallback/);
  assert.match(css, /Manrope Fallback/);
});