import assert from "node:assert/strict";
import test from "node:test";
import {
  ANNOUNCEMENT_IMAGE_MAX_BYTES,
  announcementImageRoot,
  getAnnouncementImageExtension,
  hasValidAnnouncementImageSignature,
} from "@/server/services/announcement-image";

test("accepts the image formats used for QR codes", () => {
  assert.equal(getAnnouncementImageExtension("image/png"), ".png");
  assert.equal(getAnnouncementImageExtension("image/jpeg"), ".jpg");
  assert.equal(getAnnouncementImageExtension("image/webp"), ".webp");
  assert.equal(getAnnouncementImageExtension("image/gif"), null);
});

test("keeps announcement QR images at or below two megabytes", () => {
  assert.equal(ANNOUNCEMENT_IMAGE_MAX_BYTES, 2 * 1024 * 1024);
});

test("checks the file signature instead of trusting the MIME type", () => {
  assert.equal(
    hasValidAnnouncementImageSignature(
      Buffer.from("89504e470d0a1a0a", "hex"),
      "image/png",
    ),
    true,
  );
  assert.equal(
    hasValidAnnouncementImageSignature(Buffer.from("ffd8ff", "hex"), "image/jpeg"),
    true,
  );
  assert.equal(
    hasValidAnnouncementImageSignature(
      Buffer.from("524946460000000057454250", "hex"),
      "image/webp",
    ),
    true,
  );
  assert.equal(
    hasValidAnnouncementImageSignature(Buffer.from("not-an-image"), "image/png"),
    false,
  );
});

test("stores announcement images under the persistent data directory", () => {
  const previous = process.env.DEEPROAST_DATA_DIR;
  process.env.DEEPROAST_DATA_DIR = "C:/persistent/deeproast";
  try {
    assert.match(
      announcementImageRoot().replaceAll("\\", "/"),
      /C:\/persistent\/deeproast\/announcement-images$/i,
    );
  } finally {
    if (previous === undefined) delete process.env.DEEPROAST_DATA_DIR;
    else process.env.DEEPROAST_DATA_DIR = previous;
  }
});
