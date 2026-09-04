import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const panelSource = readFileSync(
  new URL("./Img2ImgPanel.tsx", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);
const imageGenViewSource = readFileSync(
  new URL("./ImageGenView.tsx", import.meta.url),
  "utf8",
);
const mobileBarSource = readFileSync(
  new URL("./ImageMobileBar.tsx", import.meta.url),
  "utf8",
);

describe("mobile image-to-image workflow", () => {
  it("keeps the existing two-step image editing flow in the mobile sheet", () => {
    assert.match(panelSource, /img2img-mobile-step img2img-mobile-assets/);
    assert.match(panelSource, /img2img-mobile-step img2img-mobile-task/);
    assert.match(panelSource, /参考素材/);
    assert.match(panelSource, /修改任务/);
    assert.match(panelSource, /分别修改/);
    assert.match(panelSource, /参考修改/);
  });

  it("gives the mobile sheet its own visual treatment without changing the data flow", () => {
    assert.match(globalStyles, /\.mobile-creation-sheet \.img2img-mobile-step/);
    assert.match(globalStyles, /\.mobile-creation-sheet \.img2img-mobile-assets/);
    assert.match(globalStyles, /\.mobile-creation-sheet \.img2img-mobile-task/);
  });

  it("opens the mobile img2img sheet when a generated image is continued", () => {
    assert.match(imageGenViewSource, /createImageContinuationDraft/);
    assert.match(imageGenViewSource, /setImageToImageDraft\(createImageContinuationDraft\(image\)\)/);
    assert.match(imageGenViewSource, /setImageCreationMode\("edit"\)/);
    assert.match(imageGenViewSource, /openImageToImage=\{openImageToImage\}/);
    assert.match(mobileBarSource, /openImageToImage: boolean/);
    assert.match(mobileBarSource, /setToolbarOpen\("img2img"\)/);
    assert.match(mobileBarSource, /onImageToImageOpened\?\.\(\)/);
  });
});
