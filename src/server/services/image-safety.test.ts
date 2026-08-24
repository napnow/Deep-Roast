import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { ApiError } from "@/server/http";
import {
  IMAGE_UPSTREAM_TIMEOUT_MS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  MAX_IMAGE_PIXELS,
  MAX_REFERENCE_TOTAL_BYTES,
  assertImageSize,
  normalizeReferenceImages,
  preserveOrCropImage,
  readBoundedJsonResponse,
  readUpstreamImage,
  writeFileAtomically,
} from "./image";

const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("image input safety", () => {
  it("enforces the 2048 edge and 4194304 pixel limits", () => {
    assert.equal(assertImageSize("1920x1080", "gpt-image-2"), "1920x1080");
    assert.equal(assertImageSize("2048x2048", "gpt-image-2"), "2048x2048");
    assert.throws(() => assertImageSize("2049x1024", "gpt-image-2"), /尺寸/);
    assert.throws(() => assertImageSize("2048x2049", "gpt-image-2"), /尺寸/);
    assert.throws(() => assertImageSize("9999x9999", "gpt-image-2"), /尺寸/);
    assert.equal(MAX_IMAGE_EDGE, 2048);
    assert.equal(MAX_IMAGE_PIXELS, 4_194_304);
  });

  it("returns the original non-crop buffer without changing its bytes", async () => {
    const original = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const unchanged = await preserveOrCropImage(original, "1024x1024", false);
    assert.equal(unchanged, original);
    assert.deepEqual(unchanged, original);
  });

  it("preserves valid reference image bytes when converting to upstream Data URLs", async () => {
    const input = `data:image/png;base64,${ONE_PIXEL_PNG}`;
    const normalized = await normalizeReferenceImages([
      input,
      input,
      input,
      input,
      input,
    ]);
    assert.deepEqual(normalized, [input, input, input, input, input]);
  });

  it("rejects non-image, malformed, and oversized Data URLs", async () => {
    for (const value of [
      "data:text/plain;base64,SGVsbG8=",
      "data:image/png;base64,not-valid!",
      "data:image/png;base64,SGVsbG8=",
    ]) {
      await assert.rejects(
        () => normalizeReferenceImages([value]),
        (error: unknown) => error instanceof ApiError && error.status === 400,
      );
    }

    const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1).toString("base64");
    await assert.rejects(
      () => normalizeReferenceImages([`data:image/png;base64,${oversized}`]),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  });

  it("rejects private remote references before making a network request", async () => {
    await assert.rejects(
      () => normalizeReferenceImages(["https://127.0.0.1/private.png"]),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
    await assert.rejects(
      () => readUpstreamImage({ url: "https://169.254.169.254/image" }, "https://api.example/v1"),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  });

  it("uses bounded public HTTPS downloads and the upstream timeout contract", () => {
    const source = readFileSync("src/server/services/image.ts", "utf8");
    assert.equal(MAX_IMAGE_BYTES, 25 * 1024 * 1024);
    assert.equal(MAX_REFERENCE_TOTAL_BYTES, 30 * 1024 * 1024);
    assert.equal(IMAGE_UPSTREAM_TIMEOUT_MS, 300_000);
    assert.match(source, /requestPublicHttpsBuffer/);
    assert.match(source, /maxBytes:\s*MAX_IMAGE_BYTES/);
    assert.match(source, /timeoutMs:\s*IMAGE_UPSTREAM_TIMEOUT_MS/);
    assert.match(source, /redirect:\s*["']error["']/);
  });

  it("reads upstream base64 bytes without re-encoding them", async () => {
    const encoded = Buffer.from(ONE_PIXEL_PNG, "base64");
    const result = await readUpstreamImage(
      { b64_json: ONE_PIXEL_PNG },
      "https://api.example/v1",
    );
    assert.deepEqual(result, encoded);
  });

  it("rejects upstream payloads that are not real images", async () => {
    await assert.rejects(
      () =>
        readUpstreamImage(
          { b64_json: Buffer.from("not an image").toString("base64") },
          "https://api.example/v1",
        ),
      (error: unknown) =>
        error instanceof ApiError && error.code === "INVALID_IMAGE",
    );
  });

  it("writes image artifacts atomically and cleans temp files after rename failure", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "deeproast-image-"));
    try {
      const target = path.join(dir, "image.png");
      const bytes = Buffer.from([1, 2, 3, 4]);
      await writeFileAtomically(target, bytes);
      assert.deepEqual(await readFile(target), bytes);
      const mode = (await stat(target)).mode & 0o777;
      assert.equal(mode & 0o444, 0o444);
      assert.deepEqual(
        (await readdir(dir)).filter((name) => name.includes(".tmp")),
        [],
      );

      const existingDirectory = path.join(dir, "existing");
      await mkdir(existingDirectory);
      await assert.rejects(() => writeFileAtomically(existingDirectory, bytes));
      assert.deepEqual(
        (await readdir(dir)).filter((name) => name.includes(".tmp")),
        [],
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("bounds upstream JSON responses before parsing them", async () => {
    const payload = { data: [{ b64_json: ONE_PIXEL_PNG }] };
    const result = await readBoundedJsonResponse<typeof payload>(
      new Response(JSON.stringify(payload)),
      1024,
    );
    assert.deepEqual(result, payload);
    await assert.rejects(
      () =>
        readBoundedJsonResponse(
          new Response("x".repeat(1025)),
          1024,
        ),
      /上游响应过大/,
    );
  });
});
