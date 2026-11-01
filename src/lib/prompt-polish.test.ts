import assert from "node:assert/strict";
import { test } from "node:test";
import {
  POLISH_PROMPT_CREDIT_COST,
  parsePromptPolishResponse,
} from "./prompt-polish";
import {
  commitImageEditPolish,
  createImageEditPolishState,
  restoreImageEditPolish,
} from "./image-edit-polish";

test("prompt polish returns a validated prompt and preserves model metadata", () => {
  assert.deepEqual(
    parsePromptPolishResponse({ prompt: "  雨夜街头  ", model: "gpt6" }),
    { prompt: "雨夜街头", model: "gpt6" },
  );
  assert.equal(POLISH_PROMPT_CREDIT_COST, 1);
});

test("prompt polish rejects empty, malformed and oversized responses", () => {
  assert.throws(() => parsePromptPolishResponse(null));
  assert.throws(() => parsePromptPolishResponse({ prompt: "   " }));
  assert.throws(() =>
    parsePromptPolishResponse({ prompt: "x".repeat(12_001) }),
  );
});

test("image edit prompt polish commits only the instruction that was polished", () => {
  const original = "把海边日落的光线调暖，保留人物和构图";
  const unrelated = "换成一个完全不同的场景";
  const state = createImageEditPolishState({
    mode: "per-image",
    prompts: [unrelated, original],
    edit: "所有图片统一降低对比度",
    targetIndex: 1,
  });

  const polished = "将海边日落的光线调整为暖色调，保持人物和构图不变";
  const polishedState = commitImageEditPolish(state, { original, polished });

  assert.equal(polishedState.prompts[0], unrelated);
  assert.equal(polishedState.prompts[1], polished);
  assert.equal(polishedState.edit, "所有图片统一降低对比度");
  assert.deepEqual(polishedState.undo, { original, polished, ownerIndex: 1 });
});

test("image edit prompt polish undo stays scoped to the active editor", () => {
  const original = "保留主体，背景换成雨夜霓虹街道";
  const polished = "保持主体不变，将背景替换为雨夜霓虹街道";
  const state = createImageEditPolishState({
    mode: "reference",
    prompts: ["", ""],
    edit: original,
    targetIndex: 0,
  });

  const committed = commitImageEditPolish(state, { original, polished });
  assert.equal(committed.edit, polished);
  assert.equal(committed.prompts[0], "");
  assert.deepEqual(
    restoreImageEditPolish(committed, {
      edit: polished,
      prompts: ["", ""],
    }),
    { edit: original, prompts: ["", ""] },
  );
  const latest = { edit: "用户后来改写的内容", prompts: ["", ""] };
  assert.deepEqual(restoreImageEditPolish(committed, latest), latest);
});

test("image edit prompt polish never overwrites text edited while waiting", () => {
  const original = "把背景换成海边日落";
  const state = createImageEditPolishState({
    mode: "per-image",
    prompts: ["用户刚刚改写的新指令"],
    edit: "",
    targetIndex: 0,
  });

  assert.deepEqual(
    commitImageEditPolish(state, {
      original,
      polished: "将背景替换为海边日落",
    }),
    state,
  );
});

test("image edit polish restores the per-image prompt after switching images", () => {
  const original = "把第一张图的天空换成晚霞";
  const polished = "将第一张图的天空替换为晚霞";
  const committed = commitImageEditPolish(
    createImageEditPolishState({
      mode: "per-image",
      prompts: [original, "保留第二张图不动"],
      edit: "",
      targetIndex: 0,
    }),
    { original, polished },
  );

  const current = {
    edit: "",
    prompts: [polished, "保留第二张图不动"],
  };
  const switched = { ...committed, targetIndex: 1 };
  assert.deepEqual(restoreImageEditPolish(switched, current), current);
  assert.deepEqual(
    restoreImageEditPolish(
      { ...switched, targetIndex: 0 },
      {
        edit: "",
        prompts: [polished, "用户后来修改了第二张图"],
      },
    ),
    {
      edit: "",
      prompts: [original, "用户后来修改了第二张图"],
    },
  );
});
