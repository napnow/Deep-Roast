import assert from "node:assert/strict";
import test from "node:test";
import { parsePromptLibrarySource } from "./prompt-library";

test("prompt library source parser rejects oversized upstream payloads", () => {
  assert.throws(
    () => parsePromptLibrarySource(Buffer.from("[1,2,3]"), 4),
    /提示词库上游响应过大/,
  );
});

test("prompt library source parser accepts valid arrays", () => {
  assert.deepEqual(
    parsePromptLibrarySource(Buffer.from('[{"prompt":"一棵树"}]'), 1024),
    [{ prompt: "一棵树" }],
  );
});
