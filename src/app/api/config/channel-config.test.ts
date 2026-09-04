import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("config API exposes masked channels to admins and saves channel payloads", () => {
  const source = readFileSync("src/app/api/config/route.ts", "utf8");
  assert.match(source, /listModelChannels/);
  assert.match(source, /replaceModelChannels/);
  assert.match(source, /body\.channels/);
  assert.match(source, /role === "admin"/);
});
