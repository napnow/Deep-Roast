import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panelSource = readFileSync(new URL("./Img2ImgPanel.tsx", import.meta.url), "utf8");
const desktopSource = readFileSync(new URL("./CreationPanel.tsx", import.meta.url), "utf8");
const mobileSource = readFileSync(new URL("./ImageMobileBar.tsx", import.meta.url), "utf8");

test("图生图面板读取续作草稿并同步到本地 refs", () => {
  assert.match(panelSource, /hydrateImg2ImgDraft/);
  assert.match(panelSource, /setRefs\(next\.refs\)/);
  assert.match(panelSource, /draft\?: ImageToImageDraft/);
});

test("桌面与手机图生图面板都传入同一份续作草稿", () => {
  assert.match(desktopSource, /draft=\{imageToImageDraft\}/);
  assert.match(mobileSource, /draft=\{imageToImageDraft\}/);
});
