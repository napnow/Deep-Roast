import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("image deletion commits an owner-scoped record deletion before removing files", () => {
  const source = readFileSync("src/server/services/image.ts", "utf8");
  const section = source.slice(source.indexOf("export async function deleteImageRecords"), source.indexOf("export async function editImageBatch"));
  const deletion = section.indexOf(".delete(imageGenerations)");
  const artifacts = section.indexOf("deleteImageArtifacts");
  assert.ok(deletion >= 0 && artifacts > deletion);
  assert.match(section.slice(deletion, artifacts), /eq\(imageGenerations\.userId, userId\)/);
});
