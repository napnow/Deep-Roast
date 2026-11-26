import assert from "node:assert/strict";
import test from "node:test";
import bundled from "@/data/wear-library.json";
import {
  appendWearPrompt,
  filterWearLibrary,
  normalizeWearLibrary,
} from "./wear-library";
import { normalizeImageOrigin } from "@/server/services/image";

test("bundled wear-library.json keeps outfit and pose empty until visual packs are imported", () => {
  const items = normalizeWearLibrary(bundled);
  assert.equal(items.length, (bundled as unknown[]).length);
  assert.equal(filterWearLibrary(items, { kind: "outfit" }).length, 0);
  assert.equal(filterWearLibrary(items, { kind: "pose" }).length, 0);
  assert.ok(filterWearLibrary(items, { kind: "portrait" }).length >= 4);
});

test("filterWearLibrary filters visual items by kind, category, and keyword", () => {
  const sample = normalizeWearLibrary([
    {
      id: "outfit:spr-0003",
      kind: "outfit",
      title: "夹克 + 象牙白短裙裤",
      prompt: "粉色粗花呢短夹克配象牙白高腰短裙裤",
      category: "春夏",
      tags: ["SPR-0003", "套装"],
      thumbUrl: "https://example.com/spr-0003-thumb.webp",
      imageUrl: "https://example.com/spr-0003.webp",
    },
    {
      id: "pose:p001",
      kind: "pose",
      title: "后仰坐·单膝立起",
      prompt: "后仰坐姿，单膝立起，侧面视角",
      category: "坐姿",
      tags: ["P001", "侧面"],
      thumbUrl: "https://example.com/p001-thumb.webp",
      imageUrl: "https://example.com/p001.webp",
    },
  ]);
  assert.equal(filterWearLibrary(sample, { kind: "outfit", category: "春夏" }).length, 1);
  assert.equal(filterWearLibrary(sample, { kind: "pose", keyword: "p001" })[0]?.id, "pose:p001");
});

test("appendWearPrompt deduplicates repeated preset fragments", () => {
  const [first] = normalizeWearLibrary(bundled);
  assert.ok(first);
  const once = appendWearPrompt("", first);
  assert.equal(once, first.prompt);
  assert.equal(appendWearPrompt(once, first), once);
  assert.equal(appendWearPrompt("全身照", first), `全身照，${first.prompt}`);
});

test("normalizeImageOrigin accepts wear and defaults unknown inputs to create", () => {
  assert.equal(normalizeImageOrigin("wear"), "wear");
  assert.equal(normalizeImageOrigin("create"), "create");
  assert.equal(normalizeImageOrigin("other"), "create");
  assert.equal(normalizeImageOrigin(undefined), "create");
});
