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

test("registration IP limit migration preserves the current enabled default", () => {
  assert.equal(existsSync("drizzle/0020_registration_ip_limit.sql"), true);
  const sql = readFileSync("drizzle/0020_registration_ip_limit.sql", "utf8");
  assert.match(
    sql,
    /ADD COLUMN IF NOT EXISTS "registration_ip_limit_enabled" integer NOT NULL DEFAULT 1/,
  );
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)/i);
});

test("model channels migration preserves legacy config and backfills current defaults", () => {
  assert.equal(existsSync("drizzle/0021_model_channels.sql"), true);
  const sql = readFileSync("drizzle/0021_model_channels.sql", "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "llm_channels"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "llm_channel_models"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "api_key_ciphertext"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "api_key_iv"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "api_key_auth_tag"/);
  assert.match(sql, /llm_config/);
  assert.match(sql, /enabled_image_models/);
  assert.match(sql, /enabled_text_models/);
  assert.match(sql, /is_default/);
  assert.match(sql, /EXCEPTION WHEN others/);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)/i);
});

test("announcement image migration is additive", () => {
  assert.equal(existsSync("drizzle/0022_announcement_qr_image.sql"), true);
  const sql = readFileSync(
    "drizzle/0022_announcement_qr_image.sql",
    "utf8",
  );
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "image_path" text/);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)/i);
});

test("model channel key migration clears plaintext only after encryption", () => {
  const source = readFileSync("scripts/migrate-model-channel-keys.ts", "utf8");
  assert.match(source, /API_KEY_ENCRYPTION_KEY is required/);
  assert.match(source, /encryptModelChannelKey/);
  assert.match(source, /apiKey:\s*encrypted\.plaintext/);
  assert.match(source, /apiKeyCiphertext:\s*encrypted\.ciphertext/);
  assert.match(source, /db\.transaction/);
});
