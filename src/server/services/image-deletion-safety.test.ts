import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("image deletion commits an owner-scoped record deletion before removing files", () => {
  const source = readFileSync("src/server/services/image.ts", "utf8");
  const section = source.slice(source.indexOf("export async function deleteImageRecord"), source.indexOf("export async function editImageBatch"));
  const deletion = section.indexOf(".delete(imageGenerations)");
  assert.ok(deletion >= 0 && deletion < section.indexOf("await unlink("));
  assert.match(section.slice(deletion, section.indexOf("await unlink(")), /eq\(imageGenerations\.userId, userId\)/);
});
