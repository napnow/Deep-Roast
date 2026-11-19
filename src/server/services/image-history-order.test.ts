import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("image history uses a stable secondary id order for offset pagination", () => {
  const source = readFileSync(new URL("./image.ts", import.meta.url), "utf8");
  const section = source.slice(source.indexOf("export async function listImageHistory"));
  assert.match(section, /orderBy\(desc\(imageGenerations\.createdAt\),\s*desc\(imageGenerations\.id\)\)/);
});
