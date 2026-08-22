import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseStoredBoolean,
  parseStoredWorkspaceMode,
} from "./workspace-preferences";

describe("workspace preferences", () => {
  it("accepts only supported workspace modes", () => {
    assert.equal(parseStoredWorkspaceMode("image"), "image");
    assert.equal(parseStoredWorkspaceMode("chat"), "chat");
    assert.equal(parseStoredWorkspaceMode("admin"), "image");
    assert.equal(parseStoredWorkspaceMode(null), "image");
  });

  it("parses persisted booleans without truthy string mistakes", () => {
    assert.equal(parseStoredBoolean("true", false), true);
    assert.equal(parseStoredBoolean("false", true), false);
    assert.equal(parseStoredBoolean(null, true), true);
  });
});
