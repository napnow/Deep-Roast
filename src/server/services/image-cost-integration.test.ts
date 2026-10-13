import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("image generation and edit paths resolve model cost before charging", () => {
  const source = readFileSync("src/server/services/image.ts", "utf8");
  assert.match(source, /getImageModelCreditCost/);
  assert.match(source, /const imageCreditCost = await getImageModelCreditCost\(model\)/);
  assert.match(source, /reserveCredits\(\s*userId,\s*imageCreditCost/);
  assert.match(source, /calculateImageCreditCost\(imageCreditCost/);
  assert.doesNotMatch(source, /reserveCredits\(\s*userId,\s*\n\s*CREDIT_PER_IMAGE/);
  assert.doesNotMatch(source, /assertEnoughCredits\(userId, CREDIT_PER_IMAGE/);
});

test("v1 API usage accounting follows the resolved per-image cost", () => {
  const source = readFileSync("src/app/api/v1/images/generations/route.ts", "utf8");
  assert.match(source, /getImageModelCreditCost/);
  assert.match(source, /results\.length \* imageCreditCost/);
  assert.match(source, /successfulImageCount/);
  assert.match(source, /partial API key usage/);
  assert.match(source, /modelOverride: resolvedModel/);
  assert.doesNotMatch(source, /results\.length \* CREDIT_PER_IMAGE/);
});
