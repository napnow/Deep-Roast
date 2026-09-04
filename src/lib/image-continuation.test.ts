import assert from "node:assert/strict";
import test from "node:test";

import type { ImageRecord } from "@/types";
import { createImageContinuationDraft } from "./image-continuation";

test("将图片记录转换为图生图续作草稿，并保留原提示词、尺寸和图片地址", () => {
  const image: ImageRecord = {
    id: "image-1",
    prompt: "雨后的木质咖啡馆，暖色胶片风格",
    model: "gpt-image-2",
    imageUrl: "https://example.com/generated.webp",
    size: "1024x1024",
    createdAt: "2026-08-26T09:00:00.000Z",
  };

  assert.deepEqual(createImageContinuationDraft(image), {
    prompt: image.prompt,
    size: image.size,
    count: 1,
    styleId: "",
    styleColor: "",
    styleTexture: "",
    refs: [{ preview: image.imageUrl, base64: image.imageUrl }],
  });
});
