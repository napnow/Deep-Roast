import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveImageModelAfterConfigLoad } from "../../lib/image-model-preferences";

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

test("mobile image creation exposes the model picker when multiple models are enabled", () => {
  const mobile = readFileSync(
    "src/components/ImageGen/ImageMobileBar.tsx",
    "utf8",
  );

  assert.match(mobile, /disabled=\{generating \|\| imageModels\.length < 2\}/);
  assert.match(mobile, /mobile-composer-model/);
  assert.match(mobile, /onModelChange/);
  assert.match(mobile, /选择生图模型/);
});

test("initial image model follows the server default when it is enabled", () => {
  const initialData = readFileSync("src/hooks/useInitialData.ts", "utf8");

  assert.doesNotMatch(initialData, /if \(!enabled\.includes\(selectedImageModel\)\)/);
  // The production model-preference repair delegates this behavior to a helper.
  assert.match(initialData, /resolveImageModelAfterConfigLoad\(/);
  assert.equal(
    resolveImageModelAfterConfigLoad(null, "", "", ["first", "default"], "default"),
    "default",
  );
});
