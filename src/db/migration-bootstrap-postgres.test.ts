import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { Client, type ClientConfig } from "pg";
import { entryPath, requireFromRepo, type Artifacts } from "./migration-bootstrap-fixture";

// MAIN ONLY: never uses DATABASE_URL. Both an explicit disposable-test URL and
// the reset acknowledgement are required; otherwise the entire suite is skipped.
// The suite DESTROYS public in this one named local, non-default-port test DB.
const testUrl = process.env.MIGRATION_BOOTSTRAP_TEST_URL;
const acknowledgement = "yes-local-disposable";
const databaseName = "deep_roast_bootstrap_test";

type PgEntry = {
  resolveConnectionConfig: (args: string[], env: { DATABASE_URL: string }) => ClientConfig;
  loadArtifacts: () => Artifacts;
  baselineLedgerHash: (artifacts: Artifacts) => string;
  migrateDatabase: (options: { client: Client; artifacts?: Artifacts }) => Promise<{ mode: string }>;
};

test("PostgreSQL bootstrap acceptance (explicit local disposable database only)", { skip: !testUrl }, async (t) => {
  assert.equal(process.env.MIGRATION_BOOTSTRAP_TEST_ALLOW_RESET, acknowledgement,
    "refusing DB access: set the explicit disposable reset acknowledgement");
  assert.ok(testUrl);
  const api = requireFromRepo(entryPath) as PgEntry;
  const config = api.resolveConnectionConfig(["--local"], { DATABASE_URL: testUrl });
  assert.equal(config.database, databaseName, "refusing DB access: wrong disposable database name");
  assert.notEqual(config.port, 5432, "refusing DB access: use a dedicated, non-default Docker port");
  const artifacts = api.loadArtifacts();
  const last = artifacts.journal.entries.at(-1)!;
  const businessTables = [...artifacts.sql.matchAll(/^CREATE TABLE "([a-z0-9_]+)"/gm)].map((m) => m[1]).sort();
  const client = new Client(config);
  await client.connect();
  try {
    const identity = await client.query<{ name: string }>("SELECT current_database() AS name");
    assert.equal(identity.rows[0].name, databaseName, "refusing schema reset: server database identity mismatch");
    const resetPublic = () => client.query('DROP SCHEMA "public" CASCADE; CREATE SCHEMA "public";');
    const readLedger = async () => (await client.query<{ id: number; hash: string; created_at: string }>(
      'SELECT "id", "hash", "created_at"::text AS created_at FROM "public"."__drizzle_migrations" ORDER BY "id"')).rows;
    const tableNames = async () => (await client.query<{ name: string }>(
      "SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows.map((r) => r.name);
    const createLedger = () => client.query(`CREATE TABLE "public"."__drizzle_migrations" (
      "id" serial PRIMARY KEY, "hash" text NOT NULL, "created_at" bigint
    );`);
    const createSyntheticLegacy = async (entries: Artifacts["journal"]["entries"]) => {
      await resetPublic();
      await client.query(artifacts.sql);
      await createLedger();
      for (const [i, migration] of entries.entries()) {
        // Deliberately NOT hashes from this checkout: old hashes/row counts must
        // not be retroactively "fixed". These are synthetic fixture rows only.
        await client.query('INSERT INTO "public"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)',
          [String(i + 1).padStart(64, "0"), migration.when]);
      }
      await client.query("INSERT INTO public.users (username, password, credits) VALUES ('bootstrap_fixture_sentinel', 'not-a-real-login', 321)");
    };
    const readSentinel = async () => (await client.query(
      "SELECT id, username, password, credits, created_at, updated_at FROM public.users WHERE username = 'bootstrap_fixture_sentinel'")).rows;

    await t.test("fresh = complete DDL, no seeded data, one baseline marker; repeat is a no-op", async () => {
      await resetPublic();
      assert.equal((await api.migrateDatabase({ client })).mode, "baseline");
      assert.deepEqual(await tableNames(), [...businessTables, "__drizzle_migrations"].sort());
      for (const table of businessTables) {
        const count = await client.query<{ count: number }>(`SELECT count(*)::integer AS count FROM "public"."${table}"`);
        assert.equal(count.rows[0].count, 0, `baseline must never seed ${table}`);
      }
      const ledger = await readLedger();
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0].created_at, String(last.when));
      assert.equal(ledger[0].hash, api.baselineLedgerHash(artifacts));
      const fks = await client.query<{ count: number }>("SELECT count(*)::integer AS count FROM pg_catalog.pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace");
      assert.equal(fks.rows[0].count, [...artifacts.sql.matchAll(/^ALTER TABLE .* FOREIGN KEY/gm)].length);
      const indexes = (await client.query<{ name: string }>("SELECT indexname AS name FROM pg_catalog.pg_indexes WHERE schemaname = 'public'")).rows.map((r) => r.name);
      for (const match of artifacts.sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([a-z0-9_]+)"/gm)) assert.ok(indexes.includes(match[1]), match[1]);
      assert.equal((await api.migrateDatabase({ client })).mode, "incremental");
      assert.deepEqual(await readLedger(), ledger);
    });

    await t.test("two independent concurrent connections initialize once", async () => {
      await resetPublic();
      const first = new Client(config);
      const second = new Client(config);
      try {
        await Promise.all([first.connect(), second.connect()]);
        const results = await Promise.all([api.migrateDatabase({ client: first }), api.migrateDatabase({ client: second })]);
        assert.deepEqual(results.map((r) => r.mode).sort(), ["baseline", "incremental"]);
        assert.equal((await readLedger()).length, 1);
      } finally {
        await Promise.all([first.end(), second.end()]);
      }
    });

    await t.test("legacy 20-row ledger at current timestamp and sentinel data are byte-for-byte unchanged", async () => {
      await createSyntheticLegacy(artifacts.journal.entries.slice(-20));
      const ledger = await readLedger();
      const sentinel = await readSentinel();
      assert.equal(ledger.length, 20);
      assert.equal(ledger.at(-1)!.created_at, String(last.when));
      assert.equal((await api.migrateDatabase({ client })).mode, "incremental");
      assert.deepEqual(await readLedger(), ledger);
      assert.deepEqual(await readSentinel(), sentinel);
    });

    await t.test("legacy at preceding timestamp applies only actual pending 0027 via Drizzle", async () => {
      await createSyntheticLegacy(artifacts.journal.entries.slice(-21, -1));
      // This isolated fixture represents the immediately preceding schema. Never
      // issue this DROP against a real project; its only purpose is this test.
      await client.query('DROP TABLE "public"."image_model_credit_costs"');
      const ledger = await readLedger();
      const sentinel = await readSentinel();
      assert.equal((await api.migrateDatabase({ client })).mode, "incremental");
      const after = await readLedger();
      assert.deepEqual(after.slice(0, -1), ledger);
      assert.equal(after.length, ledger.length + 1);
      assert.equal(after.at(-1)!.created_at, String(last.when));
      assert.equal(after.at(-1)!.hash, createHash("sha256").update(readFileSync(path.join(artifacts.migrationsFolder, `${last.tag}.sql`))).digest("hex"));
      assert.ok((await tableNames()).includes("image_model_credit_costs"));
      assert.deepEqual(await readSentinel(), sentinel);
    });

    for (const [name, ddl] of [
      ["table", 'CREATE TABLE "public"."bootstrap_unrelated" ("id" integer)'],
      ["view", 'CREATE VIEW "public"."bootstrap_unrelated" AS SELECT 1 AS id'],
      ["sequence", 'CREATE SEQUENCE "public"."bootstrap_unrelated"'],
      ["enum", `CREATE TYPE "public"."bootstrap_unrelated" AS ENUM ('fixture')`],
      ["function", `CREATE FUNCTION "public"."bootstrap_unrelated"() RETURNS integer LANGUAGE sql AS 'SELECT 1'`],
    ]) {
      await t.test(`unrecognized ${name}-only public schema is refused, not bootstrapped`, async () => {
        await resetPublic();
        await client.query(ddl);
        const before = await tableNames();
        await assert.rejects(api.migrateDatabase({ client }), /Unrecognized database/);
        assert.deepEqual(await tableNames(), before);
        assert.equal((await client.query("SELECT to_regclass('public.__drizzle_migrations') AS ledger")).rows[0].ledger, null);
      });
    }

    await t.test("empty public with another user schema and ledger-only public are both refused", async () => {
      await resetPublic();
      await client.query('CREATE SCHEMA "bootstrap_other_app"');
      try {
        await assert.rejects(api.migrateDatabase({ client }), /Unrecognized database/);
        assert.deepEqual(await tableNames(), []);
      } finally {
        await client.query('DROP SCHEMA "bootstrap_other_app"');
      }
      await createLedger();
      await assert.rejects(api.migrateDatabase({ client }), /Unrecognized database/);
      assert.deepEqual(await tableNames(), ["__drizzle_migrations"]);
      assert.deepEqual(await readLedger(), []);
    });

    await t.test("ledger-write failure rolls back DDL, releases the lock, and permits a clean retry", async () => {
      await resetPublic();
      const realQuery = client.query.bind(client);
      client.query = (async (sql: string, params?: unknown[]) => {
        if (/^INSERT INTO "public"\."__drizzle_migrations"/.test(sql)) throw new Error("injected fixture ledger failure");
        return realQuery(sql, params);
      }) as Client["query"];
      try {
        await assert.rejects(api.migrateDatabase({ client }), /injected fixture ledger failure/);
      } finally {
        client.query = realQuery;
      }
      assert.deepEqual(await tableNames(), []);
      const locks = await client.query<{ count: number }>("SELECT count(*)::integer AS count FROM pg_catalog.pg_locks WHERE locktype = 'advisory' AND pid = pg_backend_pid()");
      assert.equal(locks.rows[0].count, 0);
      assert.equal((await api.migrateDatabase({ client })).mode, "baseline");
      assert.equal((await readLedger()).length, 1);
    });
  } finally {
    await client.end();
  }
});
