import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("recoverable API key migration is safe on the current production schema", () => {
  const sql = readFileSync("drizzle/0011_recoverable_api_keys.sql", "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS "key_ciphertext" text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "key_iv" text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "key_auth_tag" text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "image_generation_enabled" integer/);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)/i);
});
