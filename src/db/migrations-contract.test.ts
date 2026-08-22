import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("recoverable API key migration is safe on the current production schema", () => {
  assert.equal(existsSync("drizzle/meta/0011_snapshot.json"), true);
  const sql = readFileSync("drizzle/0011_recoverable_api_keys.sql", "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS "key_ciphertext" text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "key_iv" text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "key_auth_tag" text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "image_generation_enabled" integer/);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)/i);
});

test("invitation migration backfills codes and preserves invitation history", () => {
  assert.equal(existsSync("drizzle/0012_invitation_system.sql"), true);
  const sql = readFileSync("drizzle/0012_invitation_system.sql", "utf8");

  assert.match(sql, /ADD COLUMN IF NOT EXISTS "invite_code" text/);
  assert.match(sql, /UPDATE "users"[\s\S]*WHERE "role" = 'user'/);
  assert.match(sql, /"invitation_enabled" integer DEFAULT 1 NOT NULL/);
  assert.match(sql, /"invitation_reward" integer DEFAULT 200 NOT NULL/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "user_invitations"/);
  assert.match(sql, /user_invitations_invitee_unique/);
  assert.match(sql, /ON DELETE set null/);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)/i);
});
