import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("all image prompt surfaces enforce the 8000-character limit", () => {
  const textToImage = read("./TextToImageForm.tsx");
  const mobile = read("./ImageMobileBar.tsx");
  const imageToImage = read("./Img2ImgPanel.tsx");
  const service = read("../../server/services/image.ts");

  assert.match(textToImage, /maxLength=\{8000\}/);
  assert.match(textToImage, /draft\.prompt\.length\} \/ 8000/);
  assert.match(mobile, /maxLength=\{8000\}/);
  assert.equal(imageToImage.match(/maxLength=\{8000\}/g)?.length, 3);
  assert.match(imageToImage, /currentPrompt\.length\} \/ 8000/);
  assert.match(imageToImage, /edit\.length\} \/ 8000/);
  assert.match(service, /const MAX_PROMPT_LENGTH = 8000;/);
});
