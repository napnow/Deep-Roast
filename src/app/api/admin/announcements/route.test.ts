import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("admin announcement POST accepts multipart body and image fields", () => {
  const source = readFileSync("src/app/api/admin/announcements/route.ts", "utf8");
  assert.match(source, /req\.formData\(\)/);
  assert.match(source, /form\.get\(["']body["']\)/);
  assert.match(source, /form\.get\(["']image["']\)/);
  assert.match(source, /content-type/);
  assert.match(source, /readJson/);
  assert.match(source, /image\.size/);
});
