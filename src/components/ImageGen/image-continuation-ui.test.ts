import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const componentDir = path.resolve(import.meta.dirname);
const resultCanvas = fs.readFileSync(path.join(componentDir, "ResultCanvas.tsx"), "utf8");
const previewModal = fs.readFileSync(path.join(componentDir, "ImagePreviewModal.tsx"), "utf8");

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
