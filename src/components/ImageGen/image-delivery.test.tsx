import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SmartResultImage from "./SmartResultImage";
import { downloadImage, imageDownloadUrl } from "./imageUtils";
import type { ImageRecord } from "@/types";

const image = { id: "test", prompt: "test", imageUrl: "/api/images/example.png", thumbUrl: "/api/images/example.png?thumb=1", size: "1024x1024", model: "test", createdAt: "2026-01-01" } as ImageRecord;
const imageWithoutThumb = { ...image, id: "no-thumb", imageUrl: "/api/images/no-thumb.png", thumbUrl: undefined } as ImageRecord;

test("multiple results can render thumbnails without fetching original images", () => {
  const html = renderToStaticMarkup(<SmartResultImage record={image} loadFull={false} />);
  assert.match(html, /thumb=1/);
  assert.doesNotMatch(html, /src="\/api\/images\/example\.png"/);
});

test("multiple results never fetch the original when a thumbnail is missing", () => {
  const html = renderToStaticMarkup(<SmartResultImage record={imageWithoutThumb} loadFull={false} />);
  assert.match(html, /打开查看原图/);
  assert.doesNotMatch(html, /src="\/api\/images\/no-thumb\.png"/);
});

test("full preview initially renders a thumbnail while original loads asynchronously", () => {
  const html = renderToStaticMarkup(<SmartResultImage record={image} loadFull />);
  assert.match(html, /thumb=1/);
  assert.doesNotMatch(html, /src="\/api\/images\/example\.png"/);
});

test("opening a full preview without a thumbnail uses the original", () => {
  const html = renderToStaticMarkup(<SmartResultImage record={imageWithoutThumb} loadFull />);
  assert.match(html, /src="\/api\/images\/no-thumb\.png"/);
});

test("download preflight preserves existing authorization parameters", () => {
  assert.equal(imageDownloadUrl("/api/images/example.png?owner=abc"), "/api/images/example.png?owner=abc&download=check");
  assert.equal(imageDownloadUrl("/api/images/example.png"), "/api/images/example.png?download=check");
  assert.equal(imageDownloadUrl("data:image/png;base64,abc"), null);
});

test("a denied download is reported and never starts a browser download", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  let clicked = false;
  globalThis.fetch = async () => new Response(null, { status: 403 });
  globalThis.document = { createElement: () => ({ click() { clicked = true; }, remove() {} }), body: { appendChild() {} } } as unknown as Document;
  try {
    await assert.rejects(downloadImage(image), /登录|权限/);
    assert.equal(clicked, false);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
  }
});
