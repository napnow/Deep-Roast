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

test("creating the initial config row persists text defaults for prompt polish", () => {
  const source = readFileSync("src/app/api/config/route.ts", "utf8");
  const insertStart = source.indexOf("await tx.insert(llmConfig)");
  const insertEnd = source.indexOf("const [latest]", insertStart);
  assert.ok(insertStart >= 0 && insertEnd > insertStart);
  const insert = source.slice(insertStart, insertEnd);
  assert.match(insert, /textModel:/);
  assert.match(insert, /enabledTextModels:/);
  assert.match(insert, /polishPromptModel:/);
});
