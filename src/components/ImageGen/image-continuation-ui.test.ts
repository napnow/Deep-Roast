import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const componentDir = path.resolve(import.meta.dirname);
const resultCanvas = fs.readFileSync(path.join(componentDir, "ResultCanvas.tsx"), "utf8");
const previewModal = fs.readFileSync(path.join(componentDir, "ImagePreviewModal.tsx"), "utf8");
const chatView = fs.readFileSync(
  path.resolve(componentDir, "../Chat/ChatView.tsx"),
  "utf8",
);
const styles = fs.readFileSync(
  path.resolve(componentDir, "../../app/globals.css"),
  "utf8",
);

test("结果卡提供继续修改入口，并将所选图片回传给上层", () => {
  assert.match(resultCanvas, /onContinueEditing: \(item: ImageRecord\) => void/);
  assert.match(resultCanvas, /onClick=\{\(\) => onContinueEditing\(image\)\}/);
  assert.match(resultCanvas, /继续修改/);
});

test("大图预览提供继续修改入口，并保留下载、复制和删除操作", () => {
  assert.match(previewModal, /onContinueEditing: \(image: ImageRecord\) => void/);
  assert.match(previewModal, /onClick=\{\(\) => onContinueEditing\(image\)\}/);
  assert.match(previewModal, /继续修改/);
  assert.match(previewModal, /下载/);
  assert.match(previewModal, /复制提示词/);
  assert.match(previewModal, /删除/);
});

test("移动端大图和对话图片都提供可见的关闭按钮", () => {
  assert.match(previewModal, /mobile-image-preview-close/);
  assert.match(previewModal, /aria-label="关闭大图预览"/);
  assert.match(chatView, /setChatPreviewImage/);
  assert.match(chatView, /aria-label="关闭对话图片预览"/);
  assert.doesNotMatch(chatView, /target="_blank"/);
});

test("大图预览保持在手机视口内，底部操作区独立滚动", () => {
  assert.match(previewModal, /image-preview-modal/);
  assert.match(previewModal, /image-preview-modal__stage/);
  assert.match(previewModal, /image-preview-modal__footer/);
  assert.match(styles, /\.image-preview-modal[\s\S]*?height:\s*100dvh/);
  assert.match(styles, /\.image-preview-modal__stage[\s\S]*?min-height:\s*0/);
  assert.match(styles, /\.image-preview-modal__footer[\s\S]*?overflow-y:\s*auto/);
});
