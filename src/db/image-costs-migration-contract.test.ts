import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("image model credit costs migration is additive and constrained", () => {
  assert.equal(existsSync("drizzle/0027_image_model_credit_costs.sql"), true);
  const sql = readFileSync("drizzle/0027_image_model_credit_costs.sql", "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "image_model_credit_costs"/);
  assert.match(sql, /"model_id" text PRIMARY KEY/);
  assert.match(sql, /"credits_per_image" integer DEFAULT 5 NOT NULL/);
  assert.match(sql, /credits_per_image.*>= 1/i);
  assert.doesNotMatch(sql, /DROP (TABLE|COLUMN)/i);
  assert.doesNotMatch(sql, /UPDATE "(users|credit_transactions|image_generations|llm_config)"/i);
});

test("image model credit costs migration is recorded in the journal", () => {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  const entry = journal.entries.find(
    (candidate) => candidate.tag === "0027_image_model_credit_costs",
  );
  assert.deepEqual(entry, {
    idx: 22,
    version: "7",
    when: 1789000000000,
    tag: "0027_image_model_credit_costs",
    breakpoints: true,
  });
});
