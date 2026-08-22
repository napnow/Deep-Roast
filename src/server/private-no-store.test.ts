import assert from "node:assert/strict";
import { test } from "node:test";
import { privateNoStore } from "./http";

test("private no-store policy decorates success and error responses", () => {
  const success = privateNoStore(Response.json({ ok: true }));
  const error = privateNoStore(Response.json({ error: "no" }, { status: 401 }));

  assert.equal(success.headers.get("Cache-Control"), "private, no-store");
  assert.equal(error.headers.get("Cache-Control"), "private, no-store");
  assert.equal(error.status, 401);
});
