import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertEnabledTextModel } from "./model-access";

describe("text model access", () => {
  it("accepts an enabled model and trims the value", () => {
    assert.equal(
      assertEnabledTextModel("  model-a  ", {
        enabledTextModels: '["model-a"]',
        textModel: "model-a",
      }),
      "model-a",
    );
  });

  it("rejects arbitrary models outside the enabled list", () => {
    assert.throws(
      () =>
        assertEnabledTextModel("model-not-enabled", {
          enabledTextModels: '["model-a"]',
          textModel: "model-a",
        }),
      /指定的模型不可用/,
    );
  });

  it("uses the configured default when the enabled list is empty", () => {
    assert.equal(
      assertEnabledTextModel("configured-default", {
        enabledTextModels: "[]",
        textModel: "configured-default",
      }),
      "configured-default",
    );
  });
});
