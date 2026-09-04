import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("image and chat services use the configured channel resolver", () => {
  const image = readFileSync("src/server/services/image.ts", "utf8");
  const chat = readFileSync("src/server/services/chat.ts", "utf8");
  const reverse = readFileSync("src/server/services/reverse-prompt.ts", "utf8");

  assert.match(image, /resolveConfiguredEndpoint/);
  assert.match(chat, /resolveConfiguredEndpoint/);
  assert.match(reverse, /resolveConfiguredEndpoint/);
});

test("OpenAI-compatible model listing is sourced from default channel bindings", () => {
  const source = readFileSync("src/app/api/v1/models/route.ts", "utf8");
  assert.match(source, /listConfiguredModelIds/);
  assert.match(source, /"image"/);
});
