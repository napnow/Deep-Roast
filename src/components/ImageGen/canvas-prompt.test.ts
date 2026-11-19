import test from "node:test";
import assert from "node:assert/strict";
import {
  insertPromptReference,
  parsePromptReferences,
  removePromptReference,
  resolvePromptTextReferences,
  serializePromptReferences,
  type CanvasPromptReference,
} from "./canvas-prompt";

const tree: CanvasPromptReference = { id: "tree", label: "@一棵树", title: "一棵树", kind: "image", previewUrl: "/tree.png" };
const treeAlt: CanvasPromptReference = { id: "tree-alt", label: "@一棵树-夜景", title: "一棵树-夜景", kind: "image" };
const text: CanvasPromptReference = { id: "text", label: "@城市夜景", title: "城市夜景", kind: "text" };
const detailedText: CanvasPromptReference = {
  id: "text-detail",
  label: "@城市夜景#abcd1234",
  title: "城市夜景",
  kind: "text",
  text: "雨夜霓虹街头，一位撑透明伞的旅人",
};

test("parses text and longest reference labels", () => {
  const tokens = parsePromptReferences("保留 @一棵树-夜景，并参考 @一棵树", [tree, treeAlt]);
  assert.deepEqual(tokens.map((token) => token.type), ["text", "reference", "text", "reference"]);
  assert.equal(tokens[1].type === "reference" ? tokens[1].reference.id : "", "tree-alt");
});

test("inserts a reference with a stable separator", () => {
  assert.equal(insertPromptReference("一张图", tree), "一张图 @一棵树 ");
  assert.equal(insertPromptReference("", text), "@城市夜景 ");
});

test("removes only the complete reference label", () => {
  assert.equal(removePromptReference("参考 @一棵树 和 @一棵树-夜景", tree), "参考 和 @一棵树-夜景");
});

test("serialization preserves the generated request text", () => {
  const value = "以 @一棵树 为主体";
  assert.equal(serializePromptReferences(value, [tree]), value);
});

test("keeps same-title references distinct by stable node label", () => {
  const first = { ...tree, label: "@一棵树#149e2eee", id: "149e2eee" };
  const second = { ...tree, label: "@一棵树#249e2eee", id: "249e2eee" };
  const tokens = parsePromptReferences("对比 @一棵树#149e2eee 和 @一棵树#249e2eee", [first, second]);
  assert.deepEqual(tokens.filter(token => token.type === "reference").map(token => token.reference.id), [
    "149e2eee",
    "249e2eee",
  ]);
});

test("expands referenced text nodes with their complete content", () => {
  assert.equal(
    resolvePromptTextReferences("沿用 @城市夜景#abcd1234 的氛围", [detailedText]),
    "沿用 雨夜霓虹街头，一位撑透明伞的旅人 的氛围",
  );
});
