import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("chat keeps message actions visible on touch and does not autofocus", () => {
  const input = readFileSync("src/components/Chat/ChatInput.tsx", "utf8");
  const view = readFileSync("src/components/Chat/ChatView.tsx", "utf8");

  assert.doesNotMatch(input, /textareaRef\.current\?\.focus\(\)/);
  assert.match(view, /opacity-100 md:opacity-0 md:group-hover:opacity-100/);
});
