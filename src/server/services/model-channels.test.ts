import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listDefaultModelIds,
  normalizeChannelPayload,
  selectDefaultBinding,
  type ChannelBindingRecord,
} from "@/server/services/model-channels";

const apiBinding: ChannelBindingRecord = {
  channelId: "api-channel",
  channelName: "现有默认渠道",
  baseUrl: "https://api.deeproast.sryze.cc/v1",
  apiKey: "api-key",
  channelEnabled: true,
  modelId: "gpt-image-2",
  kind: "image",
  modelEnabled: true,
  isDefault: true,
};

const qkmssBinding: ChannelBindingRecord = {
  ...apiBinding,
  channelId: "qkmss-channel",
  channelName: "qkmss",
  baseUrl: "https://qkmss.com/v1",
  apiKey: "qkmss-key",
  isDefault: false,
};

test("same model id resolves only to the enabled default binding", () => {
  const selected = selectDefaultBinding(
    [qkmssBinding, apiBinding],
    "image",
    "gpt-image-2",
  );

  assert.equal(selected?.channelId, "api-channel");
  assert.deepEqual(
    listDefaultModelIds([qkmssBinding, apiBinding], "image"),
    ["gpt-image-2"],
  );
});

test("disabled or non-default channels are not selected", () => {
  assert.equal(
    selectDefaultBinding(
      [{ ...apiBinding, channelEnabled: false }],
      "image",
      "gpt-image-2",
    ),
    null,
  );
  assert.equal(
    selectDefaultBinding(
      [{ ...qkmssBinding, isDefault: false }],
      "image",
      "gpt-image-2",
    ),
    null,
  );
});

test("channel payload rejects duplicate defaults for the same model kind", () => {
  assert.throws(
    () =>
      normalizeChannelPayload([
        {
          name: "api",
          baseUrl: apiBinding.baseUrl,
          apiKey: "key-a",
          enabled: true,
          models: [
            { modelId: "gpt-image-2", kind: "image", enabled: true, isDefault: true },
          ],
        },
        {
          name: "qkmss",
          baseUrl: qkmssBinding.baseUrl,
          apiKey: "key-b",
          enabled: true,
          models: [
            { modelId: "gpt-image-2", kind: "image", enabled: true, isDefault: true },
          ],
        },
      ]),
    /只能设置一个默认渠道/,
  );
});

test("channel payload rejects disabled defaults", () => {
  assert.throws(
    () =>
      normalizeChannelPayload([
        {
          name: "disabled-default",
          baseUrl: "https://example.com/v1",
          models: [
            { modelId: "gpt-image-2", kind: "image", enabled: false, isDefault: true },
          ],
        },
      ]),
    /默认模型.*启用状态/,
  );
});
