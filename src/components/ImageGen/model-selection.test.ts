import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("image creation exposes a selector for multiple enabled image models", () => {
  const panel = readFileSync(
    "src/components/ImageGen/CreationPanel.tsx",
    "utf8",
  );
  const form = readFileSync(
    "src/components/ImageGen/TextToImageForm.tsx",
    "utf8",
  );

  assert.match(panel, /imageModels/);
  assert.match(panel, /setSelectedImageModel/);
  assert.match(form, /onModelChange/);
  assert.match(form, /imageModels\.length > 1/);
  assert.match(form, /aria-label="选择生图模型"/);
});
