import { test } from "node:test";
import assert from "node:assert/strict";
import { createAssistantImageMessage } from "./chat-image";

test("image completion event carries a renderable assistant message", () => {
  const message = createAssistantImageMessage({
    id: "image-id",
    imageUrl: "/images/avatar.png",
    thumbUrl: "/images/thumbs/avatar.webp",
    prompt: "fictional assistant portrait",
    model: "doubao-seedream-4-5-251128",
    size: "1024x1024",
  });

  assert.equal(message.role, "assistant");
  assert.equal(message.content, "我给你看看。");
  assert.equal(message.metadata?.image?.status, "success");
  assert.equal(message.metadata?.image?.id, "image-id");
});
