import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// 新界面需与线上（master 旧界面）功能对齐：这些入口被误删时测试会失败
test("redesign studio keeps feature parity with the classic workspace", () => {
  const studio = readFileSync("src/components/Redesign/RedesignStudio.tsx", "utf8");
  assert.match(studio, /<CustomRatioEditor/);
  assert.match(studio, /<CustomPixelEditor/);
  assert.match(studio, /isGptImageModel\(activeModel\)/);
  assert.match(studio, /copyText\(preview\.prompt\)/);
  assert.match(studio, /downloadImage\(preview, signal\)/);
  assert.match(studio, /downloadImage\(image, signal\)/);
  assert.match(studio, /deleteFromPreview\(preview\)/);
  assert.match(studio, /原图加载失败/);
  assert.match(studio, /网络连接中断/);
  assert.match(studio, /尚未配置生图模型/);
  assert.doesNotMatch(studio, /href=\{(image|preview)\.imageUrl\} download/);
});
