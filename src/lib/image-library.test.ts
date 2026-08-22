import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ImageRecord } from "@/types";
import {
  confirmedImageDeletionId,
  filterImages,
  groupImagesByDate,
  mergeImageSourceModes,
  reuseParametersFromImage,
} from "./image-library";

const image = (id: string, createdAt: string, prompt = "coffee"): ImageRecord => ({
  id,
  prompt,
  createdAt,
  model: "gpt-image-2",
  imageUrl: `/images/${id}.png`,
  size: "1024x1024",
});

describe("image library", () => {
  it("groups today, yesterday, and older records", () => {
    const now = new Date("2026-08-20T12:00:00+08:00");
    const groups = groupImagesByDate(
      [
        image("a", "2026-08-20T03:00:00.000Z"),
        image("b", "2026-08-19T03:00:00.000Z"),
        image("c", "2026-08-10T03:00:00.000Z"),
      ],
      now,
    );
    assert.deepEqual(groups.map((group) => group.label), ["今天", "昨天", "更早"]);
  });

  it("filters prompt and source", () => {
    const rows = mergeImageSourceModes(
      [image("a", "2026-08-20", "cat"), image("b", "2026-08-20", "dog")],
      { a: "text", b: "edit" },
    );
    assert.deepEqual(filterImages(rows, "cat", "all").map((row) => row.id), ["a"]);
    assert.deepEqual(filterImages(rows, "", "edit").map((row) => row.id), ["b"]);
  });

  it("extracts reusable parameters", () => {
    assert.deepEqual(reuseParametersFromImage(image("a", "2026-08-20", "cat")), {
      prompt: "cat",
      size: "1024x1024",
      model: "gpt-image-2",
    });
  });

  it("returns an image id only after deletion is confirmed", () => {
    assert.equal(confirmedImageDeletionId("image-1", false), null);
    assert.equal(confirmedImageDeletionId("image-1", true), "image-1");
  });
});
