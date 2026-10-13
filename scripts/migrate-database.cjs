"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- Deliberate CommonJS CLI; no TS loader or import-time DB connection. */

// No .env/config loader and no connection at import time. The CLI owns a single
// dedicated pg.Client; migrateDatabase also accepts a client for isolated tests.
const { createHash } = require("node:crypto");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LOCK_KEY = [0x44524f41, 0x53544d47]; // stable, application-specific session lock
const NORMALIZATION = "utf8-lf-trim-trailing-whitespace-v1";
const LEDGER = "__drizzle_migrations";

class MigrationSafetyError extends Error {}

function normalizeText(source) {
  return source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n")
    .split("\n").map((line) => line.replace(/[\t ]+$/g, "")).join("\n")
    .replace(/^\n+|\n+$/g, "") + "\n";
}

function normalizedHash(source) {
  return createHash("sha256").update(normalizeText(source), "utf8").digest("hex");
}

function validateArtifacts({ schemaSource, sql, metadata, journal }) {
  const entries = journal?.entries;
  if (journal?.dialect !== "postgresql" || !Array.isArray(entries) || !entries.length ||
      entries.some((item, i) => item.idx !== i || !/^[0-9]{4}_[a-z0-9_]+$/i.test(item.tag) ||
        !Number.isSafeInteger(item.when) || item.when <= 0 || (i > 0 && item.when <= entries[i - 1].when))) {
    throw new MigrationSafetyError("Invalid migration journal: ordered, unique timestamps are required.");
  }
  const last = entries.at(-1);
  if (metadata?.formatVersion !== 1 || metadata.dialect !== "postgresql" ||
      metadata.normalization !== NORMALIZATION || metadata.schemaFile !== "src/db/schema.ts" ||
      metadata.sqlFile !== "baseline.sql") {
    throw new MigrationSafetyError("Invalid baseline metadata; regenerate and review the baseline.");
  }
  if (metadata.journalLastTimestamp !== last.when || metadata.journalLastTag !== last.tag ||
      metadata.journalEntryCount !== entries.length) {
    throw new MigrationSafetyError("Baseline journal timestamp/tag/count is stale; regenerate the baseline.");
  }
  if (metadata.schemaSha256 !== normalizedHash(schemaSource)) {
    throw new MigrationSafetyError("Baseline schema hash mismatch; regenerate baseline SQL and metadata together.");
  }
  if (metadata.sqlSha256 !== normalizedHash(sql)) {
    throw new MigrationSafetyError("Baseline SQL hash mismatch; regenerate and review the baseline.");
  }
  // This intentionally accepts only the current exporter DDL vocabulary, not
  // arbitrary migrations, seeds, transaction control, functions or data dumps.
  // Mask SQL string literals before splitting so ';' inside a default is safe.
  const structure = sql.replace(/'(?:''|[^'])*'/g, "''").replace(/--[^\n]*/g, "");
  const statements = structure.split(";").map((s) => s.trim()).filter(Boolean);
  if (!statements.length || /\/\*|\*\/|\$[a-z0-9_]*\$/i.test(structure) || statements.some((s) => !(
    /^CREATE TABLE "[a-z0-9_]+"\s*\(/i.test(s) ||
    /^CREATE (?:UNIQUE )?INDEX "[a-z0-9_]+" ON "[a-z0-9_]+" /i.test(s) ||
    /^ALTER TABLE "[a-z0-9_]+" ADD CONSTRAINT "[a-z0-9_]+" FOREIGN KEY\s*\(/i.test(s)
  ))) {
    throw new MigrationSafetyError("Baseline SQL must contain schema DDL only, never data or transaction statements.");
  }
}

function loadArtifacts(directory = ROOT) {
  try {
    const migrationsFolder = path.join(directory, "drizzle");
    const sql = readFileSync(path.join(migrationsFolder, "bootstrap/baseline.sql"), "utf8");
    const metadata = JSON.parse(readFileSync(path.join(migrationsFolder, "bootstrap/metadata.json"), "utf8"));
    const journal = JSON.parse(readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8"));
    const schemaSource = readFileSync(path.join(directory, "src/db/schema.ts"), "utf8");
    validateArtifacts({ schemaSource, sql, metadata, journal });
    if (journal.entries.some((item) => !existsSync(path.join(migrationsFolder, `${item.tag}.sql`)))) {
      throw new MigrationSafetyError("A journal migration file is missing; restore the repository before migrating.");
    }
    return { schemaSource, sql, metadata, journal, migrationsFolder };
  } catch (error) {
    if (error instanceof MigrationSafetyError) throw error;
    throw new MigrationSafetyError("Cannot read baseline/schema/journal artifacts; no database work was started.");
  }
}

function baselineLedgerHash(artifacts) {
  return `baseline:v1:sha256:${artifacts.metadata.sqlSha256}`;
}

function hasTable(tables, name, columns) {
  const table = tables.find((item) => item.name === name);
  return table?.kind === "r" && table.rowSecurity === false && Object.entries(columns).every(([name, type]) =>
    table.columns.some((column) => column.name === name && column.type === type));
}

function hasLedger(tables) {
  const table = tables.find((item) => item.name === LEDGER);
  return hasTable(tables, LEDGER, { id: "int4", hash: "text", created_at: "int8" }) &&
    table.columns.length === 3 && ["id", "hash"].every((name) => table.columns.find((column) => column.name === name).notNull);
}

function classifyDatabase(state, journal) {
  const refuse = () => { throw new MigrationSafetyError(
    "Unrecognized database; refusing migration. Require a truly empty public schema or a recognized project with its public migration ledger."); };
  if (!state.publicExists) return refuse();
  if (state.publicObjectCount === 0 && !state.tables.length && !state.latestMigration) {
    if (state.otherSchemas.length) return refuse();
    return "baseline";
  }
  // A recognized public project may retain an unused historical tooling schema.
  // Incremental migration still reads/writes only the configured public ledger.
  if (!hasLedger(state.tables) || !hasTable(state.tables, "users", { id: "uuid", username: "text", password: "text" }) ||
      !hasTable(state.tables, "conversations", { id: "uuid", user_id: "uuid", title: "text" }) ||
      !hasTable(state.tables, "messages", { id: "uuid", conversation_id: "uuid", role: "text", content: "text" }) ||
      !hasTable(state.tables, "llm_config", { id: "int4", ark_api_key: "text", text_model: "text" })) return refuse();
  const latest = state.latestMigration;
  const timestamp = Number(latest?.created_at);
  // Legacy file hashes may reflect different line endings or historical edits.
  // Recognize their format and known cursor, not exact hashes or row counts.
  if (!latest || !Number.isInteger(latest.id) || latest.id <= 0 || !/^\d+$/.test(String(latest.created_at)) ||
      !Number.isSafeInteger(timestamp) || !journal.entries.some((item) => item.when === timestamp) ||
      !/^(?:[a-f0-9]{64}|baseline:v1:sha256:[a-f0-9]{64})$/i.test(latest.hash)) return refuse();
  return "incremental";
}

async function inspectDatabase(client) {
  const namespace = await client.query(`/* migration-bootstrap:namespace */
    SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'public') AS public_exists,
      (SELECT count(*)::integer FROM pg_catalog.pg_depend AS d
        JOIN pg_catalog.pg_namespace AS n ON d.refobjid = n.oid
        WHERE d.refclassid = 'pg_catalog.pg_namespace'::regclass AND n.nspname = 'public')
      + (SELECT count(*)::integer FROM pg_catalog.pg_extension AS e
        JOIN pg_catalog.pg_namespace AS n ON e.extnamespace = n.oid WHERE n.nspname = 'public') AS public_object_count,
      COALESCE((SELECT json_agg(nspname ORDER BY nspname) FROM pg_catalog.pg_namespace
        WHERE nspname NOT IN ('public', 'information_schema') AND nspname !~ '^pg_'), '[]'::json) AS other_schemas`);
  const tables = await client.query(`/* migration-bootstrap:tables */
    SELECT c.relname AS name, c.relkind AS kind, c.relrowsecurity AS "rowSecurity",
      COALESCE(json_agg(json_build_object('name', a.attname, 'type', t.typname, 'notNull', a.attnotnull)
        ORDER BY a.attnum) FILTER (WHERE a.attnum > 0 AND NOT a.attisdropped), '[]'::json) AS columns
    FROM pg_catalog.pg_class AS c JOIN pg_catalog.pg_namespace AS n ON c.relnamespace = n.oid
      LEFT JOIN pg_catalog.pg_attribute AS a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      LEFT JOIN pg_catalog.pg_type AS t ON t.oid = a.atttypid
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    GROUP BY c.oid, c.relname, c.relkind, c.relrowsecurity ORDER BY c.relname`);
  let latestMigration = null;
  // Never SELECT from an unrecognized ledger-shaped view/table.
  if (hasLedger(tables.rows)) {
    const ledger = await client.query(`SELECT m."id", m."hash", m."created_at"::text AS created_at
      FROM "public"."__drizzle_migrations" AS m ORDER BY m."created_at" DESC LIMIT 1`);
    latestMigration = ledger.rows[0] ?? null;
  }
  const row = namespace.rows[0];
  return { publicExists: row.public_exists, publicObjectCount: row.public_object_count,
    otherSchemas: row.other_schemas, tables: tables.rows, latestMigration };
}

async function originalDrizzleMigrate(client, config) {
  const { drizzle } = require("drizzle-orm/node-postgres");
  const { migrate } = require("drizzle-orm/node-postgres/migrator");
  await migrate(drizzle(client), config);
}

async function migrateDatabase({ client, artifacts = loadArtifacts(), runDrizzle = originalDrizzleMigrate }) {
  validateArtifacts(artifacts); // exported callers have the same fail-closed artifact gate as the CLI
  let locked = false;
  let transaction = false;
  try {
    // Do not inherit a URL/role search_path pointing at another schema. A
    // dedicated client is required: the settings and session lock are not pooled.
    await client.query("SET search_path TO public");
    await client.query("SET lock_timeout = '30s'");
    await client.query("SET statement_timeout = '120s'");
    await client.query("SELECT pg_catalog.pg_advisory_lock($1, $2)", LOCK_KEY);
    locked = true;
    // BEGIN AFTER the lock so a waiter inspects the committed winner's schema.
    await client.query("BEGIN");
    transaction = true;
    const mode = classifyDatabase(await inspectDatabase(client), artifacts.journal);
    if (mode === "baseline") {
      await client.query(artifacts.sql);
      await client.query(`CREATE TABLE "public"."__drizzle_migrations" (
        "id" serial PRIMARY KEY,
        "hash" text NOT NULL,
        "created_at" bigint
      );`);
      await client.query('INSERT INTO "public"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)',
        [baselineLedgerHash(artifacts), artifacts.metadata.journalLastTimestamp]);
      await client.query("COMMIT");
      transaction = false;
      return { mode, timestamp: artifacts.metadata.journalLastTimestamp };
    }
    // Drizzle owns its own transaction. Keep the SESSION lock across its ledger
    // read + writes; an outer BEGIN would be incorrectly committed by Drizzle.
    await client.query("COMMIT");
    transaction = false;
    await runDrizzle(client, { migrationsFolder: artifacts.migrationsFolder,
      migrationsSchema: "public", migrationsTable: LEDGER });
    return { mode };
  } catch (error) {
    if (transaction) await client.query("ROLLBACK").catch(() => {});
    throw error; // Never fall back to bootstrap after an incremental failure.
  } finally {
    if (locked) await client.query("SELECT pg_catalog.pg_advisory_unlock($1, $2)", LOCK_KEY);
  }
}

function resolveConnectionConfig(argv, env) {
  if (argv.some((arg) => arg !== "--local")) {
    throw new MigrationSafetyError("Unknown CLI option; use --local or --help. Environment files are not loaded.");
  }
  if (!env.DATABASE_URL) throw new MigrationSafetyError("DATABASE_URL is required in the process environment; no .env files are read.");
  const invalid = () => { throw new MigrationSafetyError("Invalid DATABASE_URL; require an explicit PostgreSQL URL with user, host and database."); };
  let url;
  let user, password, database;
  try {
    url = new URL(env.DATABASE_URL);
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch { return invalid(); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !user || !database ||
      database.includes("/") || url.hash || /[\x00-\x1f]/.test(user + password + database)) return invalid();
  const local = argv.includes("--local");
  let host = url.hostname.replace(/^\[|\]$/g, "");
  if (local && !["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new MigrationSafetyError("--local refuses non-loopback database hosts.");
  }
  if ([...url.searchParams.keys()].some((key) => key !== "sslmode") || url.searchParams.getAll("sslmode").length > 1) {
    throw new MigrationSafetyError("DATABASE_URL options other than sslmode are refused; connection redirects and file options are not allowed.");
  }
  const sslmode = url.searchParams.get("sslmode") ?? "disable";
  if (!["disable", "require", "verify-full"].includes(sslmode) || (local && sslmode !== "disable")) {
    throw new MigrationSafetyError("Invalid DATABASE_URL sslmode; --local requires a plain loopback connection.");
  }
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return invalid();
  if (local && host === "localhost") host = "127.0.0.1"; // avoid DNS/hosts-file redirects
  return { host, port, user, database, password: password || (() => ""), ssl: sslmode !== "disable",
    options: "-c search_path=public", application_name: "deep-roast-migrate",
    connectionTimeoutMillis: 10000 };
}

async function main({ argv = process.argv.slice(2), env = process.env,
  createClient = (config) => new (require("pg").Client)(config), logger = console } = {}) {
  try {
    if (argv.length === 1 && argv[0] === "--help") {
      logger.log("Usage: node scripts/migrate-database.cjs [--local]\nSet DATABASE_URL explicitly in the process environment. No .env/config files are loaded.");
      return 0;
    }
    const config = resolveConnectionConfig(argv, env);
    const artifacts = loadArtifacts(); // fail closed before constructing/connecting a client
    const client = createClient(config);
    let result;
    try {
      await client.connect();
      result = await migrateDatabase({ client, artifacts });
    } finally {
      await client.end();
    }
    logger.log(result.mode === "baseline" ? `Database baseline applied (journal timestamp ${result.timestamp}).` : "Incremental migrations completed.");
    return 0;
  } catch (error) {
    // Driver errors/cause/detail/stack may contain credentials, SQL or row data.
    // Only messages produced here are safe to expose; never log a raw pg error.
    logger.error(error instanceof MigrationSafetyError ? error.message : "Database migration failed; driver details suppressed. Inspect the isolated database with trusted tooling.");
    return 1;
  }
}

module.exports = { normalizeText, normalizedHash, validateArtifacts, loadArtifacts, baselineLedgerHash,
  classifyDatabase, inspectDatabase, migrateDatabase, resolveConnectionConfig, main };

if (require.main === module) {
  main().then((code) => { process.exitCode = code; });
}
