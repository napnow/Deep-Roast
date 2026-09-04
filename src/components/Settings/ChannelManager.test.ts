import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createChannelDrafts,
  setDefaultChannelModel,
  type ChannelDraft,
} from "@/components/Settings/ChannelManager";

test("legacy config becomes one current default channel without adding models", () => {
  const channels = createChannelDrafts({
    arkApiKey: "",
    baseUrl: "https://api.deeproast.sryze.cc/v1",
    textModel: "grok-4.5",
    imageModel: "gpt-image-2",
    imageSystemPrompt: "",
    assistantImagePrompt: "",
    reversePromptModel: "",
    apiKeyHint: "api-****-key",
    enabledTextModels: ["grok-4.5"],
    enabledImageModels: ["gpt-image-2"],
  });

  assert.equal(channels.length, 1);
  assert.equal(channels[0].name, "现有默认渠道");
  assert.equal(channels[0].baseUrl, "https://api.deeproast.sryze.cc/v1");
  assert.deepEqual(
    channels[0].models.map((model) => [model.kind, model.modelId, model.isDefault]),
    [
      ["text", "grok-4.5", true],
      ["image", "gpt-image-2", true],
    ],
  );
});

test("setting a same-name model default clears only that model's other channel default", () => {
  const channels: ChannelDraft[] = [
    {
      id: "api",
      name: "现有默认渠道",
      baseUrl: "https://api.deeproast.sryze.cc/v1",
      apiKey: "",
      apiKeyHint: "api-****-key",
      enabled: true,
      sortOrder: 0,
      models: [
        { modelId: "gpt-image-2", kind: "image", enabled: true, isDefault: true },
        { modelId: "grok-4.5", kind: "text", enabled: true, isDefault: true },
      ],
    },
    {
      id: "qkmss",
      name: "qkmss",
      baseUrl: "https://qkmss.com/v1",
      apiKey: "new-key",
      apiKeyHint: "",
      enabled: true,
      sortOrder: 1,
      models: [
        { modelId: "gpt-image-2", kind: "image", enabled: true, isDefault: false },
      ],
    },
  ];

  const updated = setDefaultChannelModel(channels, "qkmss", "image", "gpt-image-2");
  assert.equal(updated[0].models[0].isDefault, false);
  assert.equal(updated[0].models[1].isDefault, true);
  assert.equal(updated[1].models[0].isDefault, true);
});
