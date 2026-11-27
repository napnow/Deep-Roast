import assert from "node:assert/strict";
import test from "node:test";
import {
  GEMINI_IMAGE_MODEL_1K,
  GEMINI_IMAGE_MODEL_2K,
} from "../../lib/image-model-capabilities";
import {
  buildGeminiImagePayload,
  extractGeminiInlineImage,
  geminiGenerateUrl,
  geminiImageRoot,
  readGeminiSseImage,
} from "./gemini-image";

test("gemini url drops the openai style /v1 prefix", () => {
  assert.equal(
    geminiImageRoot("https://gateway.example/v1"),
    "https://gateway.example",
  );
  assert.equal(
    geminiImageRoot("https://gateway.example/v1beta/"),
    "https://gateway.example",
  );
  assert.equal(
    geminiGenerateUrl("https://gateway.example/v1"),
    "https://gateway.example/v1beta/models/gemini-3.1-flash-image:streamGenerateContent?alt=sse",
  );
});

test("1k payload omits imageSize while 2k requests it", () => {
  const one = buildGeminiImagePayload({
    prompt: "a red apple",
    aspectRatio: "9:16",
    model: GEMINI_IMAGE_MODEL_1K,
  }) as {
    contents: Array<{ parts: Array<{ text: string }> }>;
    generationConfig: {
      responseModalities: string[];
      imageConfig: { aspectRatio: string; imageSize?: string };
    };
  };
  assert.equal(one.contents[0]?.parts[0]?.text, "a red apple");
  assert.deepEqual(one.generationConfig.responseModalities, ["IMAGE"]);
  assert.deepEqual(one.generationConfig.imageConfig, { aspectRatio: "9:16" });

  const two = buildGeminiImagePayload({
    prompt: "a red apple",
    aspectRatio: "1:1",
    model: GEMINI_IMAGE_MODEL_2K,
  }) as { generationConfig: { imageConfig: Record<string, string> } };
  assert.deepEqual(two.generationConfig.imageConfig, {
    aspectRatio: "1:1",
    imageSize: "2K",
  });
});

test("inline image extraction understands camelCase and snake_case", () => {
  assert.deepEqual(
    extractGeminiInlineImage({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: "image/jpeg", data: "AAA" } }],
          },
        },
      ],
    }),
    { mimeType: "image/jpeg", data: "AAA" },
  );
  assert.deepEqual(
    extractGeminiInlineImage({
      candidates: [
        {
          content: {
            parts: [{ inline_data: { mime_type: "image/png", data: "BBB" } }],
          },
        },
      ],
    }),
    { mimeType: "image/png", data: "BBB" },
  );
  assert.equal(
    extractGeminiInlineImage({
      candidates: [{ content: { parts: [{ text: "working" }] } }],
    }),
    null,
  );
});

test("sse reader skips progress events and returns the final image", async () => {
  const chunks = [
    'data: {"candidates":[{"content":{"parts":[{"text":"started"}]}}]}\n\n',
    'data: {"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"image/jpeg","data":"AAAA"}}]}}]}',
  ];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
  assert.deepEqual(await readGeminiSseImage(stream), {
    mimeType: "image/jpeg",
    data: "AAAA",
  });
});

test("sse reader surfaces safety block and fails when upstream returns no image", async () => {
  const blockedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          'data: {"candidates":[{"finishReason":"IMAGE_SAFETY"}]}\n\n',
        ),
      );
      controller.close();
    },
  });
  await assert.rejects(readGeminiSseImage(blockedStream), /图片未通过上游内容审核/);

  const emptyStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          'data: {"candidates":[{"content":{"parts":[{"text":"started"}]}}]}\n\n',
        ),
      );
      controller.close();
    },
  });
  await assert.rejects(readGeminiSseImage(emptyStream), /上游未返回图片/);
});
