import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("image-to-image exposes the same polish action for desktop and mobile", () => {
  const panel = read("./Img2ImgPanel.tsx");

  assert.match(panel, /\/api\/polish-prompt/);
  assert.match(panel, /POLISH_PROMPT_CREDIT_COST/);
  assert.match(panel, /润色修改指令/);
  assert.match(panel, /已润色 · 恢复原文/);
  assert.match(panel, /commitImageEditPolish/);
  assert.match(panel, /Idempotency-Key/);
  assert.match(panel, /userSessionVersion/);
});

test("image-to-image polish keeps only one instruction and never charges on failure", () => {
  const panel = read("./Img2ImgPanel.tsx");

  assert.match(panel, /if \(!original \|\| polishRef\.current \|\| processing\) return;/);
  assert.match(panel, /setCredits\(\(current\) =>/);
  assert.match(panel, /POLISH_PROMPT_CREDIT_COST/);
  assert.match(panel, /error instanceof ApiError && error\.status === 402/);
  assert.match(panel, /aria-busy=\{polishing\}/);
});
