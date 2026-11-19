import assert from "node:assert/strict";
import test from "node:test";
import { planImageDeletions, type DeletableImage } from "./image-deletion";

const record = (overrides: Partial<DeletableImage> = {}): DeletableImage => ({
  id: "a",
  userId: "owner",
  versionGroupId: "group-a",
  ...overrides,
});

test("selected deletion deduplicates ids and never expands a version group", () => {
  const result = planImageDeletions(
    [record(), record({ id: "b" }), record({ id: "c", versionGroupId: "group-b" })],
    ["a", "a", "missing"],
    { mode: "selected", userId: "owner" },
  );
  assert.deepEqual(result.map((item) => item.id), ["a"]);
});

test("version-group deletion selects every owned member of the group", () => {
  const result = planImageDeletions(
    [record(), record({ id: "b" }), record({ id: "c", versionGroupId: "group-b" }), record({ id: "d", userId: "other" })],
    [],
    { mode: "version-group", userId: "owner", versionGroupId: "group-a" },
  );
  assert.deepEqual(result.map((item) => item.id), ["a", "b"]);
});

test("group deletion rejects a missing group id", () => {
  assert.throws(
    () => planImageDeletions([record()], [], { mode: "version-group", userId: "owner" }),
    /版本组不能为空/,
  );
});
