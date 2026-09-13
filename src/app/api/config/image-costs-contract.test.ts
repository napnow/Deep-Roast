import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("config API exposes model-aware image costs without sensitive credentials", () => {
  const route = readFileSync("src/app/api/config/route.ts", "utf8");
  const types = readFileSync("src/types/index.ts", "utf8");
  assert.match(route, /imageModelCosts/);
  assert.match(route, /getImageModelCreditCosts/);
  assert.match(types, /imageModelCosts\??:\s*Record<string, number>/);
  assert.doesNotMatch(route, /imageModelCosts\s*:\s*config\./);
});
