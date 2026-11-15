import assert from "node:assert/strict";
import test from "node:test";
import { imageResponse } from "./image-response";

test("image response returns original bytes and stays private and uncached", async () => {
  const bytes = Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3]);
  const response = imageResponse(bytes, "image.png", false, false);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-disposition"), null);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test("thumbnail requests are not treated as original downloads", () => {
  const response = imageResponse(new Uint8Array([1]), "image.png", true, true);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("content-disposition"), null);
});

test("preflight does not transfer image bytes and refuses malformed images", async () => {
  const bytes = Uint8Array.from([137,80,78,71,13,10,26,10]);
  const response = imageResponse(bytes, "image.png", false, true, true);
  assert.equal(response.status, 204);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
  assert.throws(() => imageResponse(new TextEncoder().encode("not an image"), "image.png", false, true, true), /图片内容无效/);
});
