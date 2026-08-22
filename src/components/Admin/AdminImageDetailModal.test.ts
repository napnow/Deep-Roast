import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const componentSource = readFileSync(
  new URL("./AdminImageDetailModal.tsx", import.meta.url),
  "utf8",
);

test("keeps prompt rendering outside the image media region", () => {
  const mediaStart = componentSource.indexOf(
    'data-testid="admin-image-detail-media"',
  );
  const mediaEnd = componentSource.indexOf(
    'data-testid="admin-image-detail-info"',
  );

  assert.notEqual(mediaStart, -1, "media region marker is required");
  assert.notEqual(mediaEnd, -1, "info region marker is required");
  assert.ok(mediaStart < mediaEnd, "media must appear before info");

  const mediaSource = componentSource
    .slice(mediaStart, mediaEnd)
    .replace('alt={image.prompt}', "");
  assert.doesNotMatch(
    mediaSource,
    /\{image\.prompt\}/,
    "prompt must not render over the image",
  );
  assert.match(
    componentSource.slice(mediaEnd),
    /\{image\.prompt\}/,
    "prompt must render in the info region",
  );
});

test("lets the whole modal scroll without clipping the image media region", () => {
  const mediaOpening = componentSource.match(
    /data-testid="admin-image-detail-media"[\s\S]*?className="([^"]+)"/,
  );
  const infoOpening = componentSource.match(
    /data-testid="admin-image-detail-info"[\s\S]*?className="([^"]+)"/,
  );
  const imageOpening = componentSource.match(
    /<img[\s\S]*?className="([^"]+)"/,
  );

  assert.ok(mediaOpening, "media class is required");
  assert.ok(infoOpening, "info class is required");
  assert.ok(imageOpening, "image class is required");

  assert.match(
    componentSource,
    /className="relative z-10 flex min-h-full items-start justify-center overflow-y-auto p-3 sm:p-6"/,
    "the modal viewport must own scrolling",
  );
  assert.doesNotMatch(
    mediaOpening[1],
    /\bflex-1\b|\boverflow-hidden\b/,
    "media must not be compressed or clipped by its own container",
  );
  assert.doesNotMatch(
    infoOpening[1],
    /max-h-\[42vh\]|overflow-y-auto/,
    "details must scroll with the whole modal",
  );
  assert.match(
    imageOpening[1],
    /\bh-auto\b.*\bmax-h-\[70vh\].*\bmax-w-full\b.*\bobject-contain\b/,
    "image must preserve its full aspect ratio within the viewport",
  );
});
