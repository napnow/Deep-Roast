import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  assertSiteAssetKey,
  siteAssetPublicPath,
  siteAssetRoot,
} from "./site-assets";

test("contact and donation images live under the persistent data root", () => {
  const previous = process.env.DEEPROAST_DATA_DIR;
  process.env.DEEPROAST_DATA_DIR = path.join("C:\\tmp", "deeproast-data");
  try {
    assert.equal(
      siteAssetRoot("contact"),
      path.resolve(process.env.DEEPROAST_DATA_DIR, "site-assets", "contact"),
    );
    assert.equal(
      siteAssetPublicPath(
        "donation",
        "00000000-0000-0000-0000-000000000000.png",
      ),
      "/api/public/site-assets/donation/00000000-0000-0000-0000-000000000000.png",
    );
  } finally {
    if (previous === undefined) delete process.env.DEEPROAST_DATA_DIR;
    else process.env.DEEPROAST_DATA_DIR = previous;
  }
});

test("site asset routes require a live database association", async () => {
  const route = await readFile(
    "src/app/api/public/site-assets/[kind]/[key]/route.ts",
    "utf8",
  );
  const announcementRoute = await readFile(
    "src/app/api/public/announcement-images/[key]/route.ts",
    "utf8",
  );
  assert.match(route, /associatedPath !== expectedPath/);
  assert.match(announcementRoute, /announcements\.imagePath/);
  assert.throws(() => assertSiteAssetKey("../secret.png"));
});
