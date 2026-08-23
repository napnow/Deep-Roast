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

test("drizzle migrations use the existing public migration ledger", () => {
  const config = readFileSync("drizzle.config.ts", "utf8");
  assert.match(config, /migrations\s*:\s*\{[\s\S]*schema\s*:\s*["']public["']/);
});

test("short invitation migration preserves old links", () => {
  assert.equal(existsSync("drizzle/0013_short_invitation_codes.sql"), true);
  const sql = readFileSync("drizzle/0013_short_invitation_codes.sql", "utf8");

  assert.match(sql, /legacy_invite_code/);
  assert.match(sql, /UPDATE "users"[\s\S]*legacy_invite_code/);
  assert.match(sql, /CREATE UNIQUE INDEX/);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)/i);
});

test("short-code schema keeps the legacy index partial like the migration", () => {
  const schema = readFileSync("src/db/schema.ts", "utf8");
  assert.match(
    schema,
    /legacyInviteCodeUnique[\s\S]*?\.where\(sql`\$\{table\.legacyInviteCode\} IS NOT NULL`\)/,
  );
});

test("invitee reward migration preserves old balances and defaults history to zero", () => {
  assert.equal(existsSync("drizzle/0014_invitee_invitation_reward.sql"), true);
  const sql = readFileSync(
    "drizzle/0014_invitee_invitation_reward.sql",
    "utf8",
  );
  assert.match(sql, /invitation_invitee_reward/);
  assert.match(sql, /DEFAULT 50/);
  assert.match(sql, /invitee_reward_amount/);
  assert.match(sql, /DEFAULT 0/);
  assert.match(sql, /NON_NEGATIVE|non_negative|>= 0/i);
  assert.doesNotMatch(sql, /UPDATE "users"[\s\S]*credits/i);
});

test("security performance migration is additive and covers service query order", () => {
  assert.equal(existsSync("drizzle/0017_security_performance_indexes.sql"), true);
  const sql = readFileSync("drizzle/0017_security_performance_indexes.sql", "utf8");
  for (const name of [
    "conversations_user_updated_idx",
    "messages_conversation_created_idx",
    "image_generations_user_created_idx",
    "credit_transactions_user_created_idx",
    "api_keys_user_status_idx",
  ]) {
    assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS "' + name + '"'));
  }
  assert.ok(!/\b(DROP|DELETE|UPDATE|TRUNCATE|ALTER TABLE)\b/i.test(sql));
});
