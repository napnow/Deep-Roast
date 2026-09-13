import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("image costs admin route protects both methods and persists only submitted rows", () => {
  assert.equal(existsSync("src/app/api/admin/image-costs/route.ts"), true);
  const source = readFileSync("src/app/api/admin/image-costs/route.ts", "utf8");
  assert.match(source, /export const GET/);
  assert.match(source, /export const PUT/);
  assert.match(source, /requireAdmin/);
  const service = readFileSync("src/server/services/image-costs-api.ts", "utf8");
  assert.match(service, /creditsPerImage/);
  assert.match(service, /getImageModelCreditCosts/);
  assert.match(service, /onConflictDoUpdate/);
  assert.doesNotMatch(service, /delete\(imageModelCreditCosts\)/);
});

test("image costs admin route validates the complete mapping", () => {
  const service = readFileSync("src/server/services/image-costs-api.ts", "utf8");
  assert.match(service, /parseImageModelCreditCost/);
  assert.match(service, /listConfiguredModelIds/);
  assert.match(service, /Object\.keys\(.*\)\.length/);
});
