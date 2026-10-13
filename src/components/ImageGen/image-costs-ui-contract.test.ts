import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("desktop and mobile image creation surfaces derive cost from selected model", () => {
  const desktop = readFileSync("src/components/ImageGen/CreationPanel.tsx", "utf8");
  const mobile = readFileSync("src/components/ImageGen/ImageMobileBar.tsx", "utf8");
  const input = readFileSync("src/components/ImageGen/ImageInputColumn.tsx", "utf8");
  const img2img = readFileSync("src/components/ImageGen/Img2ImgPanel.tsx", "utf8");
  assert.match(desktop, /imageModelCosts/);
  assert.match(desktop, /selectedImageModel/);
  assert.match(mobile, /imageModelCosts/);
  assert.match(input, /imageModelCosts/);
  assert.match(img2img, /imageCostPerImage/);
  assert.doesNotMatch(img2img, /每张 5 积分/);
  assert.doesNotMatch(desktop, /generationCost\(textToImageDraft\.count, CREDIT_PER_IMAGE\)/);
  assert.doesNotMatch(mobile, /credits >= CREDIT_PER_IMAGE/);
});

test("wallet and API access copy does not hard-code the old price", () => {
  const wallet = readFileSync("src/components/CreditWalletModal.tsx", "utf8");
  const apiKeys = readFileSync("src/components/ApiKeysModal.tsx", "utf8");
  const quickStart = readFileSync("src/components/ApiKeys/ApiQuickStart.tsx", "utf8");
  assert.match(wallet, /imageModelCosts|每张图消耗/);
  assert.doesNotMatch(apiKeys, /每张图消耗 5 积分/);
  assert.match(quickStart, /imageCostHint/);
  assert.doesNotMatch(quickStart, /每张图扣 5 积分/);
});

test("mobile model picker keeps the sheet compact and shows model-specific prices", () => {
  const mobile = readFileSync("src/components/ImageGen/ImageMobileBar.tsx", "utf8");
  const styles = readFileSync("src/app/globals.css", "utf8");
  const picker = mobile.match(
    /className=\"mobile-model-picker\"[\s\S]*?ImageRatioPicker presentation="chips"/,
  )?.[0];

  assert.ok(picker, "mobile model picker should have a bounded source section");
  assert.match(picker, /imageModelCosts/);
  assert.match(picker, /getImageModelLabel/);
  assert.match(picker, /<small>\{modelId\}<\/small>/);
  assert.match(mobile, /mobile-creation-sheet--\$\{toolbarOpen\}/);
  assert.match(styles, /\.mobile-creation-sheet--model/);
  assert.match(styles, /\.mobile-creation-sheet--model[\s\S]*?height: auto/);
});
