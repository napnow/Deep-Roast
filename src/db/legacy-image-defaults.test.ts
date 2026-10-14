import assert from "node:assert/strict";
import { test } from "node:test";
import { imageGenerations, llmConfig } from "./schema";
import { DEFAULT_IMAGE_MODELS } from "@/types";

test("new database rows default to GPT Image 2", () => {
  assert.equal(llmConfig.imageModel.default, "gpt-image-2");
  const enabledDefault = llmConfig.enabledImageModels.default;
  assert.ok(typeof enabledDefault === "string");
  assert.deepEqual(JSON.parse(enabledDefault), [
    "gpt-image-2",
    "gpt-image-2.5-flare",
    "gpt-image-2.5-sunburst",
  ]);
  assert.equal(imageGenerations.model.default, "gpt-image-2");
});

test("image model catalog only contains GPT Image models", () => {
  assert.deepEqual(DEFAULT_IMAGE_MODELS.map((model) => model.id), [
    "gpt-image-2",
    "gpt-image-2.5-flare",
    "gpt-image-2.5-sunburst",
  ]);
});
