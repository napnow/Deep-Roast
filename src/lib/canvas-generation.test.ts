import assert from "node:assert/strict";
import test from "node:test";
import { settleCanvasVariantRequests } from "./canvas-generation";

test("keeps successful canvas variants when another request fails", async () => {
  const attempts = [1, 2, 3];
  const result = await settleCanvasVariantRequests(attempts.length, async () => {
    const attempt = attempts.shift()!;
    if (attempt === 2) throw new Error("provider failed");
    return `image-${attempt}`;
  });

  assert.deepEqual(result.values, ["image-1", "image-3"]);
  assert.equal(result.errors.length, 1);
  assert.match(String(result.errors[0]), /provider failed/);
});

test("runs the requested number of canvas variants independently", async () => {
  let calls = 0;
  const result = await settleCanvasVariantRequests(4, async () => {
    calls += 1;
    return calls;
  });

  assert.equal(calls, 4);
  assert.deepEqual(result.values, [1, 2, 3, 4]);
  assert.deepEqual(result.errors, []);
});
