import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const modalPath = "src/components/ApiKeysModal.tsx";
const rowPath = "src/components/ApiKeys/ApiKeyRow.tsx";
const quickStartPath = "src/components/ApiKeys/ApiQuickStart.tsx";

test("API access modal exposes a clear responsive management layout", () => {
  assert.equal(existsSync(rowPath), true, "API Key row component should exist");
  assert.equal(existsSync(quickStartPath), true, "quick-start component should exist");

  const modal = readFileSync(modalPath, "utf8");
  const row = readFileSync(rowPath, "utf8");
  const quickStart = readFileSync(quickStartPath, "utf8");

  assert.match(modal, /创建新 Key/);
  assert.match(modal, /max-w-\[36rem\]/);
  assert.match(modal, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(modal, /aria-label="关闭 API 接入"/);
  assert.match(modal, />Key 备注</);
  assert.match(modal, /sessionRef/);
  assert.match(modal, /closeModal/);
  assert.match(row, /显示/);
  assert.match(row, /复制/);
  assert.match(row, /重新生成/);
  assert.match(quickStart, /复制示例/);
  assert.match(quickStart, /whitespace-pre-wrap break-words/);
  assert.doesNotMatch(quickStart, /overflow-x-auto/);
});
