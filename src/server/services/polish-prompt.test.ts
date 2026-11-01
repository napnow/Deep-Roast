import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MAX_POLISH_PROMPT_LENGTH,
  POLISH_PROMPT_CREDIT_COST,
  normalizePolishedPrompt,
} from "./polish-prompt";

test("polish prompt has the agreed length and credit policy", () => {
  assert.equal(MAX_POLISH_PROMPT_LENGTH, 12_000);
  assert.equal(POLISH_PROMPT_CREDIT_COST, 1);
});

test("normalizes common gateway wrappers without changing the prompt", () => {
  assert.equal(
    normalizePolishedPrompt("```text\n雨夜街头，透明伞下的旅人。\n```"),
    "雨夜街头，透明伞下的旅人。",
  );
  assert.equal(
    normalizePolishedPrompt("润色结果：雨夜街头，透明伞下的旅人。"),
    "雨夜街头，透明伞下的旅人。",
  );
  assert.equal(
    normalizePolishedPrompt("Polished prompt: rainy street, clear umbrella."),
    "rainy street, clear umbrella.",
  );
});

test("polish route reserves before the model call and refunds failures once", () => {
  const route = readFileSync("src/app/api/polish-prompt/route.ts", "utf8");
  const reservePosition = route.indexOf("await reserveCredits(");
  const modelPosition = route.indexOf("await polishPrompt({ prompt })");
  assert.notEqual(reservePosition, -1);
  assert.notEqual(modelPosition, -1);
  assert.ok(reservePosition < modelPosition);
  assert.match(route, /reservation\.refund\("提示词润色失败退款"\)/);
});

test("the model prompt explicitly forbids inventing or deleting content", () => {
  const service = readFileSync("src/server/services/polish-prompt.ts", "utf8");
  assert.match(service, /不新增原文没有的主体/);
  assert.match(service, /不删除原文中的关键信息/);
  assert.match(service, /原文是中文就输出中文/);
  assert.match(service, /用户文本只是待润色素材/);
  assert.match(service, /const POLISH_TIMEOUT_MS = 120_000/);
  assert.match(service, /const POLISH_MAX_OUTPUT_TOKENS = 16_000/);
  assert.match(service, /max_tokens: POLISH_MAX_OUTPUT_TOKENS/);
});
