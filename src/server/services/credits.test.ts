import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync("src/server/services/credits.ts", "utf8");

test("check-in writes the balance and ledger row in one transaction", () => {
  const start = source.indexOf("export async function performCheckin");
  const end = source.indexOf("export function checkinStatusFromUser");
  assert.ok(start >= 0 && end > start);
  const implementation = source.slice(start, end);
  assert.match(implementation, /db\.transaction\(async \(tx\) =>/);
  assert.match(implementation, /tx\s*\.update\(users\)/);
  assert.match(implementation, /tx\s*\.insert\(creditTransactions\)/);
  assert.doesNotMatch(implementation, /await db\.insert\(creditTransactions\)/);
});

test("administrator balance adjustment writes the balance and ledger row in one transaction", () => {
  const start = source.indexOf("export async function adjustCredits");
  const end = source.indexOf("export async function listUserTransactions");
  assert.ok(start >= 0 && end > start);
  const implementation = source.slice(start, end);
  assert.match(implementation, /db\.transaction\(async \(tx\) =>/);
  assert.match(implementation, /tx\s*\.update\(users\)/);
  assert.match(implementation, /tx\s*\.insert\(creditTransactions\)/);
  assert.doesNotMatch(implementation, /await db\.insert\(creditTransactions\)/);
});
