import assert from "node:assert/strict";
import { test } from "node:test";
import { assertBuildMemory } from "../../scripts/check-build-memory.cjs";

const GiB = 1024 ** 3;
test("small production hosts are rejected before Next compilation", () => {
  assert.throws(() => assertBuildMemory({ totalBytes: 843 * 1024 ** 2, constrainedBytes: 0 }), /memory|内存/i);
});
test("a container memory cap cannot be hidden by a larger host", () => {
  assert.throws(() => assertBuildMemory({ totalBytes: 16 * GiB, constrainedBytes: 300 * 1024 ** 2 }), /memory|内存/i);
});
test("an adequately sized offline Linux builder is accepted", () => {
  assert.equal(assertBuildMemory({ totalBytes: 8 * GiB, constrainedBytes: 2 * GiB }), 2 * GiB);
});