import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { databaseState, emptySnapshot, entry, legacySnapshot, projectTables, RecordingClient, runCurrentEntry } from "./migration-bootstrap-fixture";

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
const lastTimestamp = journal.entries.at(-1).when;

function subject() {
  const value = entry();
  assert.ok(value, "the safe migration entry must be implemented before any database can be touched");
  return value;
}

test("fresh public schema bootstraps instead of replaying duplicate historical CREATE TABLE", async () => {
  const client = new RecordingClient();
  let result: { mode: string } | undefined;
  await assert.doesNotReject(async () => { result = await runCurrentEntry(client); });
  assert.equal(result?.mode, "baseline");
  assert.equal(client.state.ledger.length, 1);
  assert.equal(client.state.ledger[0].created_at, String(lastTimestamp));
  assert.match(client.state.ledger[0].hash, /^baseline:v1:sha256:[a-f0-9]{64}$/);
  for (const name of ["api_keys", "cards", "image_model_credit_costs", "site_settings", "announcements"]) {
    assert.ok(client.state.tables.some((table) => table.name === name), name);
  }
});

test("unrecognized nonempty database is rejected BEFORE any CREATE/ALTER/INSERT", async () => {
  const client = new RecordingClient(databaseState({ ...emptySnapshot(), publicObjectCount: 1,
    tables: [{ name: "unrelated", kind: "r", rowSecurity: false, columns: [] }] }));
  await assert.rejects(runCurrentEntry(client), /unrecognized|refus/i);
  assert.equal(client.calls.filter((call) => /^(create|alter|insert|update|delete|drop)\b/i.test(call.text)).length, 0);
});

test("baseline classification requires genuinely empty catalogs, not just no rows or tables", () => {
  const api = subject();
  assert.equal(api.classifyDatabase(emptySnapshot(), journal), "baseline");
  for (const state of [
    { ...emptySnapshot(), publicExists: false },
    { ...emptySnapshot(), publicObjectCount: 1 }, // enum, function, view, sequence, extension, etc.
    { ...emptySnapshot(), otherSchemas: ["drizzle"] },
    { ...emptySnapshot(), otherSchemas: ["unrelated_app"] },
    { ...emptySnapshot(), publicObjectCount: 1, tables: [projectTables().at(-1)!] },
    { ...legacySnapshot(), latestMigration: null },
  ]) assert.throws(() => api.classifyDatabase(state, journal), /unrecognized|refus/i);
});

test("recognizes legacy project identity without requiring 23 rows or rewriting old hashes", () => {
  const api = subject();
  assert.equal(api.classifyDatabase(legacySnapshot(), journal), "incremental");
  assert.equal(api.classifyDatabase(legacySnapshot(journal.entries.at(-2).when), journal), "incremental");
  const oldBaseline = legacySnapshot(journal.entries.at(-2).when);
  oldBaseline.latestMigration!.hash = `baseline:v1:sha256:${"b".repeat(64)}`;
  assert.equal(api.classifyDatabase(oldBaseline, journal), "incremental");
});

test("rejects unknown/future/null ledger cursors and impostor project schemas", () => {
  const api = subject();
  const invalid = [
    legacySnapshot(lastTimestamp + 1),
    { ...legacySnapshot(), latestMigration: { id: 1, hash: "a".repeat(64), created_at: null } },
    { ...legacySnapshot(), latestMigration: { id: 1, hash: "not-a-migration", created_at: String(lastTimestamp) } },
    { ...legacySnapshot(), tables: projectTables().filter((t) => t.name !== "users") },
    { ...legacySnapshot(), tables: projectTables().map((t) => t.name === "__drizzle_migrations" ? { ...t, kind: "v" } : t) },
    { ...legacySnapshot(), tables: projectTables().map((t) => t.name === "__drizzle_migrations" ? { ...t, rowSecurity: true } : t) },
    { ...legacySnapshot(), tables: projectTables().map((t) => t.name === "users" ? { ...t, columns: t.columns.filter((c) => c.name !== "password") } : t) },
  ];
  for (const state of invalid) assert.throws(() => api.classifyDatabase(state, journal), /unrecognized|refus/i);
});

test("all 20 legacy ledger rows are preserved and only original Drizzle handles incremental work", async () => {
  const api = subject();
  const client = new RecordingClient(databaseState(legacySnapshot()));
  client.state.ledger = journal.entries.slice(-20).map((item: { when: number }, i: number) => ({ id: i + 1,
    hash: String(i + 1).padStart(64, "0"), created_at: String(item.when) }));
  const before = structuredClone(client.state.ledger);
  let calls = 0;
  const result = await api.migrateDatabase({ client, runDrizzle: async (received, config) => {
    calls++;
    assert.equal(received, client);
    assert.equal(config.migrationsSchema, "public");
    assert.equal(config.migrationsTable, "__drizzle_migrations");
    assert.match(config.migrationsFolder, /drizzle$/);
    assert.equal(client.calls.at(-1)?.text, "COMMIT", "do not nest a BEGIN around Drizzle's own transaction");
  } });
  assert.equal(result.mode, "incremental");
  assert.equal(calls, 1);
  assert.deepEqual(client.state.ledger, before);
  assert.equal(client.calls.some((c) => /^(create|alter|insert|update|delete|drop)\b/i.test(c.text)), false);
  assert.match(client.calls.at(-1)!.text, /pg_advisory_unlock/);
});

test("baseline schema and ledger commit atomically while the session lock spans inspection", async () => {
  const api = subject();
  const client = new RecordingClient();
  await api.migrateDatabase({ client });
  const sql = client.calls.map((c) => c.text);
  const lock = sql.findIndex((s) => /pg_advisory_lock\(/.test(s));
  const begin = sql.findIndex((s) => /^BEGIN/.test(s));
  const inspect = sql.findIndex((s) => s.includes("migration-bootstrap:namespace"));
  const create = sql.findIndex((s) => /^CREATE TABLE/i.test(s));
  const insert = sql.findIndex((s) => /^INSERT INTO "public"\."__drizzle_migrations"/i.test(s));
  const commit = sql.indexOf("COMMIT");
  const unlock = sql.findIndex((s) => /pg_advisory_unlock\(/.test(s));
  assert.ok(lock >= 0 && lock < begin && begin < inspect && inspect < create && create < insert && insert < commit && commit < unlock);
  assert.deepEqual(client.calls[insert].values, [api.baselineLedgerHash(api.loadArtifacts()), lastTimestamp]);
});

test("failed baseline ledger insert rolls back every table and always releases the lock", async () => {
  const api = subject();
  const client = new RecordingClient();
  client.failOn = /^INSERT INTO "public"\."__drizzle_migrations"/i;
  await assert.rejects(api.migrateDatabase({ client }), /fixture database failure/);
  assert.deepEqual(client.state.tables, []);
  assert.deepEqual(client.state.ledger, []);
  assert.equal(client.calls.some((c) => c.text === "COMMIT"), false);
  assert.equal(client.calls.some((c) => c.text === "ROLLBACK"), true);
  assert.match(client.calls.at(-1)!.text, /pg_advisory_unlock/);
});

test("repeat and two concurrent fresh callers create exactly one baseline ledger record", async () => {
  const api = subject();
  const shared = databaseState();
  const clients = [new RecordingClient(shared), new RecordingClient(shared)];
  const results = await Promise.all(clients.map((client) => api.migrateDatabase({ client })));
  assert.deepEqual(results.map((r) => r.mode).sort(), ["baseline", "incremental"]);
  assert.equal(shared.ledger.length, 1);
  assert.equal((await api.migrateDatabase({ client: new RecordingClient(shared) })).mode, "incremental");
  assert.equal(shared.ledger.length, 1);
});

test("incremental failure never falls back to baseline or rewrites any applied ledger row", async () => {
  const api = subject();
  const client = new RecordingClient(databaseState(legacySnapshot()));
  const before = structuredClone(client.state.ledger);
  await assert.rejects(api.migrateDatabase({ client, runDrizzle: async () => { throw new Error("pending migration failed"); } }), /pending migration failed/);
  assert.deepEqual(client.state.ledger, before);
  assert.equal(client.calls.some((c) => /^(create|alter|insert|update|delete|drop)\b/i.test(c.text)), false);
  assert.match(client.calls.at(-1)!.text, /pg_advisory_unlock/);
});
test("exported runner also validates supplied artifacts before sending even one query", async () => {
  const api = subject();
  const artifacts = api.loadArtifacts();
  for (const invalid of [
    { ...artifacts, sql: `${artifacts.sql}\nINSERT INTO users DEFAULT VALUES;` },
    { ...artifacts, metadata: { ...artifacts.metadata, journalLastTimestamp: 1 } },
  ]) {
    const client = new RecordingClient();
    await assert.rejects(api.migrateDatabase({ client, artifacts: invalid }), /baseline|hash|journal/i);
    assert.equal(client.calls.length, 0);
  }
});

test("the actual Drizzle adapter keeps all 20 legacy rows when the cursor is current", async () => {
  const client = new RecordingClient(databaseState(legacySnapshot()));
  client.state.ledger = journal.entries.slice(-20).map((item: { when: number }, i: number) => ({ id: i + 1,
    hash: "d".repeat(64), created_at: String(item.when) }));
  const before = structuredClone(client.state.ledger);
  assert.equal((await subject().migrateDatabase({ client })).mode, "incremental");
  assert.deepEqual(client.state.ledger, before);
  assert.equal(client.calls.some((c) => /^CREATE SCHEMA IF NOT EXISTS "public"/i.test(c.text)), true, "exercise original Drizzle, not a policy mock");
  assert.equal(client.calls.some((c) => /^(insert|update|delete|drop|alter)\b/i.test(c.text)), false);
});

test("the actual Drizzle adapter appends only the newer journal migration", async () => {
  const client = new RecordingClient(databaseState(legacySnapshot(journal.entries.at(-2).when)));
  const before = structuredClone(client.state.ledger);
  assert.equal((await subject().migrateDatabase({ client })).mode, "incremental");
  assert.deepEqual(client.state.ledger.slice(0, -1), before);
  assert.equal(client.state.ledger.length, before.length + 1);
  assert.equal(client.state.ledger.at(-1)?.created_at, String(lastTimestamp));
  assert.ok(client.state.tables.some((t) => t.name === "image_model_credit_costs"));
  assert.equal(client.calls.some((c) => /^CREATE TABLE "announcements"/i.test(c.text)), false);
});

test("lock acquisition failure sends no BEGIN, inspection or DDL and does not pretend to unlock", async () => {
  const client = new RecordingClient();
  client.failOn = /pg_advisory_lock\(/;
  await assert.rejects(subject().migrateDatabase({ client }), /fixture database failure/);
  assert.equal(client.calls.some((c) => /^BEGIN|migration-bootstrap:|^CREATE|^INSERT|pg_advisory_unlock/.test(c.text)), false);
});

test("recognized production public ledger may coexist with the historical drizzle namespace", () => {
  const state = { ...legacySnapshot(), otherSchemas: ["drizzle"] };
  assert.equal(subject().classifyDatabase(state, journal), "incremental");
});