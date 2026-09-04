import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(
  new URL("../hooks/useChatActions.ts", import.meta.url),
  "utf8",
);

test("chat action has a terminal cleanup path for streaming state", () => {
  assert.match(source, /finally\s*\{/);
  assert.match(source, /setStreaming\(false\)/);
  assert.match(source, /AbortController/);
});
