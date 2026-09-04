import { test } from "node:test";
import assert from "node:assert/strict";
import { detectAssistantAppearanceIntent } from "./conversational-image-intent";
import type { MessageImage } from "@/types";

test("recognizes natural requests to see the assistant", () => {
  assert.ok(detectAssistantAppearanceIntent("我想看看你"));
  assert.ok(detectAssistantAppearanceIntent("给我看看你的样子"));
  assert.ok(detectAssistantAppearanceIntent("你长什么样？"));
});

test("does not turn ordinary conversation into image generation", () => {
  assert.equal(detectAssistantAppearanceIntent("帮我写一段文案"), null);
  assert.equal(detectAssistantAppearanceIntent("今天适合做什么"), null);
});

test("image message metadata has a stable success shape", () => {
  const image: MessageImage = {
    status: "success",
    id: "image-id",
    imageUrl: "/images/avatar.png",
    prompt: "fictional assistant portrait",
    model: "doubao-seedream-4-5-251128",
    size: "1024x1024",
  };
  assert.equal(image.status, "success");
  assert.match(image.imageUrl || "", /^\//);
});
