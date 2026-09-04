import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiKeyRecoveryLabel,
  apiKeyStatusLabel,
  buildApiCurlExample,
  canDismissCreatedKey,
  maskApiKey,
} from "./api-key-ui";

describe("API key UI", () => {
  it("requires saved acknowledgement", () => {
    assert.equal(canDismissCreatedKey(false), false);
    assert.equal(canDismissCreatedKey(true), true);
  });

  it("labels statuses", () => {
    assert.equal(apiKeyStatusLabel("active"), "已启用");
    assert.equal(apiKeyStatusLabel("disabled"), "已停用");
  });

  it("formats masked keys and legacy recovery state", () => {
    assert.equal(maskApiKey("sk-dr-a1b2c3"), "sk-dr-a1b2c3••••••••");
    assert.equal(apiKeyRecoveryLabel(false), "旧版 Key，无法恢复");
    assert.equal(apiKeyRecoveryLabel(true), "可随时显示和复制");
  });

  it("builds a readable curl example for the current origin", () => {
    const command = buildApiCurlExample("https://deeproast.sryze.cc/");

    assert.match(command, /https:\/\/deeproast\.sryze\.cc\/api\/v1\/images\/generations/);
    assert.match(command, /Authorization: Bearer sk-dr-你的Key/);
    assert.match(command, /Content-Type: application\/json/);
    assert.match(command, /"model":"<生图模型>"/);
    assert.match(command, /"prompt":"一只猫"/);
    assert.match(command, /"size":"1024x1024"/);
    assert.match(command, /"n":1/);
    assert.ok(command.split("\n").length >= 4);
  });
});
