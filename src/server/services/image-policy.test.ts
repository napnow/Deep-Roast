import { test } from "node:test";
import assert from "node:assert/strict";
import { imagePolicyError } from "./image-policy";

test("reports an explicit nudity category without exposing upstream text", () => {
  const error = imagePolicyError({ error: { code: "content_policy_violation", message: "Nudity blocked; private prompt: SECRET_WORD" } }, "edit");
  assert.equal(error?.code, "IMAGE_CONTENT_POLICY");
  assert.match(error?.message ?? "", /裸露/);
  assert.match(error?.message ?? "", /参考图/);
  assert.doesNotMatch(error?.message ?? "", /SECRET_WORD/);
});

test("does not guess a category or classify other 400 responses as content policy", () => {
  const policy = imagePolicyError({ error: { code: "content_policy_violation", message: "request rejected" } }, "generate");
  assert.equal(policy?.code, "IMAGE_CONTENT_POLICY");
  assert.doesNotMatch(policy?.message ?? "", /裸露|色情|参考图/);
  assert.equal(imagePolicyError({ error: { code: "invalid_api_key", message: "nude" } }, "generate"), null);
});
