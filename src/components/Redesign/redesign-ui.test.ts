import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ImageRecord } from "@/types";
import { dayLabel, groupImageBatches, sizeAspect, splitStylePrompt } from "./redesign-ui";

function img(id: string, createdAt: string, extra: Partial<ImageRecord> = {}): ImageRecord {
  return { id, prompt: "一棵树", model: "gpt-image-2", imageUrl: `/${id}.png`, size: "1024x1024", createdAt, sourceMode: "text", ...extra };
}

describe("redesign batch grouping", () => {
  it("merges images of one request and orders batches newest first", () => {
    const batches = groupImageBatches([
      img("a", "2026-11-23T09:00:00Z"),
      img("b", "2026-11-23T09:00:20Z"),
      img("c", "2026-11-23T10:00:00Z"),
    ]);
    assert.deepEqual(batches.map((b) => b.images.map((i) => i.id)), [["c"], ["b", "a"]]);
  });

  it("splits when prompt, size or mode differ", () => {
    const batches = groupImageBatches([
      img("a", "2026-11-23T09:00:00Z"),
      img("b", "2026-11-23T09:00:05Z", { size: "1536x1024" }),
      img("c", "2026-11-23T09:00:10Z", { sourceMode: "edit" }),
      img("d", "2026-11-23T09:00:15Z", { prompt: "一只猫" }),
    ]);
    assert.equal(batches.length, 4);
  });
});

describe("redesign labels", () => {
  it("labels days relative to now", () => {
    const now = new Date(2026, 10, 23, 12);
    assert.equal(dayLabel(new Date(2026, 10, 23, 8).toISOString(), now), "今天");
    assert.equal(dayLabel(new Date(2026, 10, 22, 23).toISOString(), now), "昨天");
    assert.equal(dayLabel(new Date(2026, 10, 19, 9).toISOString(), now), "11月19日");
  });

  it("reduces sizes to ratios", () => {
    assert.equal(sizeAspect("1536x1024").label, "3:2");
    assert.equal(sizeAspect("1024x1024").label, "1:1");
    assert.equal(sizeAspect("1376x768").label, "16:9");
    assert.equal(sizeAspect("1792x2400").label, "3:4");
    assert.equal(sizeAspect("bad").w, 1);
  });

  it("splits a style preset prefix back out of the prompt", () => {
    const parts = splitStylePrompt("超写实摄影风格，自然光，高细节，8K超清，专业构图\n\n一棵树");
    assert.equal(parts.prompt, "一棵树");
    assert.equal(parts.styleLabel, "写实摄影");
    assert.equal(splitStylePrompt("一棵树").stylePrompt, "");
  });
});
