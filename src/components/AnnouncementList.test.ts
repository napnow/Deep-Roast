import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("announcement images are collapsed behind an accessible toggle", () => {
  const source = readFileSync("src/components/AnnouncementList.tsx", "utf8");
  assert.match(source, /imageUrl/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /max-w-full/);
  assert.match(source, /微信群二维码/);
});
