import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

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

test("migration journal only references migrations committed with the project", () => {
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: Array<{ tag: string }> };
  for (const entry of journal.entries) {
    assert.equal(existsSync(`drizzle/${entry.tag}.sql`), true, entry.tag);
  }
});

test("short invitation migration preserves old links", () => {
  assert.equal(existsSync("drizzle/0013_short_invitation_codes.sql"), true);
  const sql = readFileSync("drizzle/0013_short_invitation_codes.sql", "utf8");

  assert.match(sql, /legacy_invite_code/);
  assert.match(sql, /UPDATE "users"[\s\S]*legacy_invite_code/);
  assert.match(sql, /CREATE UNIQUE INDEX/);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)/i);
});
