import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("AI capabilities page mounts the image cost configuration card", () => {
  const page = readFileSync("src/components/Admin/AdminAiCapabilitiesPage.tsx", "utf8");
  const card = readFileSync("src/components/Admin/AdminImageCostsCard.tsx", "utf8");
  assert.match(page, /AdminImageCostsCard/);
  assert.match(card, /\/api\/admin\/image-costs/);
  assert.match(card, /imageModelCosts/);
  assert.match(card, /type=\"number\"/);
  assert.match(card, /配置失败|保存失败/);
});
