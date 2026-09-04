import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("admin image lists use authenticated owner-scoped image URLs", () => {
  const source = readFileSync("src/server/services/admin.ts", "utf8");
  assert.match(source, /withImageOwner\(protectedImageUrl\(row\.storageKey\), userId\)/);
  assert.match(source, /protectedLegacyImageUrl/);
});

test("deleting a user removes private originals and thumbnails", () => {
  const source = readFileSync("src/server/services/admin.ts", "utf8");
  assert.match(source, /privateImagePath\(privateImageRoot\(\), img\.storageKey\)/);
  assert.match(source, /privateThumbnailPath\(privateImageRoot\(\), img\.storageKey\)/);
});
