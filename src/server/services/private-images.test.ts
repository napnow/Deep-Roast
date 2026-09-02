import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertStorageKey,
  privateImagePath,
  privateThumbnailPath,
} from "./private-images";

describe("private image storage", () => {
  it("accepts only a single safe image storage key", () => {
    assert.equal(
      assertStorageKey("3f3e3c3b-3a39-4837-8b36-123456789abc.png"),
      "3f3e3c3b-3a39-4837-8b36-123456789abc.png",
    );
    assert.throws(() => assertStorageKey("../secret.png"));
    assert.throws(() => assertStorageKey("thumbs/secret.png"));
    assert.throws(() => assertStorageKey("image.svg"));
  });

  it("keeps original and thumbnail paths beneath the private root", () => {
    const root = "D:/deeproast-data/images";
    const key = "3f3e3c3b-3a39-4837-8b36-123456789abc.png";
    assert.equal(
      privateImagePath(root, key),
      "D:/deeproast-data/images/3f3e3c3b-3a39-4837-8b36-123456789abc.png",
    );
    assert.equal(
      privateThumbnailPath(root, key),
      "D:/deeproast-data/images/thumbs/3f3e3c3b-3a39-4837-8b36-123456789abc.webp",
    );
  });
});
