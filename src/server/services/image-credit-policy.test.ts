import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ApiError } from "@/server/http";
import { shouldRetryImageError } from "./image";

function section(source: string, start: string, end: string): string {
  source = source.replace(/\r\n/g, "\n");
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source section: ${start}`);
  assert.notEqual(endIndex, -1, `missing source section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

describe("image credit reservation policy", () => {
  it("keeps insufficient-credit errors non-retryable", () => {
    assert.equal(
      shouldRetryImageError(
        new ApiError("积分不足", 402, "INSUFFICIENT_CREDITS"),
      ),
      false,
    );
  });

  it("does not retry image processing or database failures", () => {
    assert.equal(shouldRetryImageError(new Error("sharp failed")), false);
    assert.equal(shouldRetryImageError(new Error("database failed")), false);
  });

  it("reserves once and refunds through the idempotent reservation on text-to-image failure", () => {
    const source = readFileSync("src/server/services/image.ts", "utf8");
    const generation = section(
      source,
      "export async function generateImage",
      "/**\n * 图生图",
    );
    assert.match(source, /reserveCredits/);
    assert.match(generation, /reserveCredits\(/);
    assert.match(generation, /refundImageReservation\(/);
    assert.doesNotMatch(generation, /consumeCredits|refundCredits/);
  });

  it("reserves once and refunds through the idempotent reservation on image-edit failure", () => {
    const source = readFileSync("src/server/services/image.ts", "utf8");
    const edit = section(
      source,
      "async function editImageOnce",
      "export async function editImage(",
    );
    assert.match(edit, /reserveCredits\(/);
    assert.match(edit, /refundImageReservation\(/);
    assert.doesNotMatch(edit, /assertEnoughCredits|consumeCredits|refundCredits/);
  });

  it("does not expose upstream response bodies as public image errors", () => {
    const source = readFileSync("src/server/services/image.ts", "utf8");
    const edit = section(
      source,
      "async function editImageOnce",
      "export async function editImage(",
    );
    assert.doesNotMatch(edit, /errText/);
    assert.match(edit, /PUBLIC_IMAGE_EDIT_ERROR/);
  });
});
