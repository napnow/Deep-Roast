import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { entry, entryPath, root, RecordingClient } from "./migration-bootstrap-fixture";

function subject() {
  const value = entry();
  assert.ok(value, "the migration CLI must exist and be safe to import");
  return value;
}

const localUrl = "postgresql://bootstrap:fixture_password@127.0.0.1:55439/deep_roast_bootstrap_test";

// No inherited DATABASE_URL, PG*, NODE_OPTIONS or application environment.
function offlineEnv(): NodeJS.ProcessEnv {
  return { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
    TMP: process.env.TMP, TSX_DISABLE_CACHE: "1", NODE_ENV: "test" };
}

test("import neither connects nor loads .env/config even if a DATABASE_URL is present", () => {
  assert.ok(existsSync(entryPath), "new CLI entry required");
  const output = execFileSync(process.execPath, ["-e", `
    const fs = require('node:fs');
    const original = fs.readFileSync;
    fs.readFileSync = function (file, ...args) {
      if (/(^|[\\\\/])\\.env(?:[.\\\\/]|$)|drizzle\\.config\\./i.test(String(file))) throw new Error('environment/config read forbidden');
      return original.call(this, file, ...args);
    };
    require('node:net').Socket.prototype.connect = function () { throw new Error('network forbidden'); };
    const api = require(${JSON.stringify(entryPath)});
    if (typeof api.migrateDatabase !== 'function') throw new Error('export missing');
    process.stdout.write('import-safe');
  `], { cwd: root, encoding: "utf8", env: { ...offlineEnv(), DATABASE_URL: "postgres://not-used:never@remote.invalid/never" } });
  assert.equal(output, "import-safe");
});

test("CLI requires explicit process DATABASE_URL instead of falling back to files or PGHOST", () => {
  assert.throws(() => subject().resolveConnectionConfig([], { PGHOST: "remote.invalid" }), /DATABASE_URL/);
  assert.throws(() => subject().resolveConnectionConfig(["--env-file", ".env"], { DATABASE_URL: localUrl }), /argument|option|env.file/i);
});

test("--local builds an explicit loopback pg config immune to PGHOST/PGPORT overrides", () => {
  const api = subject();
  const config = api.resolveConnectionConfig(["--local"], { DATABASE_URL: localUrl, PGHOST: "remote.invalid", PGPORT: "9999", PGSSLMODE: "require" });
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 55439);
  assert.equal(config.database, "deep_roast_bootstrap_test");
  assert.equal(config.user, "bootstrap");
  assert.equal(config.password, "fixture_password");
  assert.equal(config.ssl, false);
  assert.equal(config.connectionString, undefined, "do not let pg reparse URL query host overrides");
  assert.equal(api.resolveConnectionConfig(["--local"], { DATABASE_URL: localUrl.replace("127.0.0.1", "localhost") }).host, "127.0.0.1");
  assert.equal(api.resolveConnectionConfig(["--local"], { DATABASE_URL: localUrl.replace("127.0.0.1", "[::1]") }).host, "::1");
});

test("--local rejects remote/lookalike hosts and URL options that could redirect the connection", () => {
  const api = subject();
  for (const url of [
    localUrl.replace("127.0.0.1", "remote.invalid"),
    localUrl.replace("127.0.0.1", "localhost.remote.invalid"),
    `${localUrl}?host=remote.invalid`, `${localUrl}?hostaddr=203.0.113.1`,
    `${localUrl}?options=-csearch_path%3Delsewhere`, `${localUrl}?sslcert=private.key`,
    `${localUrl}#fragment`, "file:///private.env", "postgresql:///missing-host",
  ]) assert.throws(() => api.resolveConnectionConfig(["--local"], { DATABASE_URL: url }), /local|URL|option|host/i);
});

test("CLI refuses unsafe config before constructing any client and does not print the URL", async () => {
  const logs: string[] = [];
  let constructed = false;
  const code = await subject().main({ argv: ["--local"], env: { DATABASE_URL: localUrl.replace("127.0.0.1", "remote.invalid") },
    createClient: () => { constructed = true; throw new Error("must not construct"); },
    logger: { log: (message) => logs.push(message), error: (message) => logs.push(message) } });
  assert.equal(code, 1);
  assert.equal(constructed, false);
  assert.ok(logs.length > 0);
  assert.doesNotMatch(logs.join("\n"), /fixture_password|postgres|remote\.invalid/);
});

test("CLI closes the connection and suppresses raw driver errors (including nested URL/secrets)", async () => {
  const api = subject();
  const client = new RecordingClient();
  client.connect = async () => { throw Object.assign(new Error(`password=fixture_password ${localUrl}`), {
    code: "28P01", cause: new Error(localUrl), detail: "fixture_password",
  }); };
  const logs: string[] = [];
  const code = await api.main({ argv: ["--local"], env: { DATABASE_URL: localUrl }, createClient: () => client,
    logger: { log: (s) => logs.push(s), error: (s) => logs.push(s) } });
  assert.equal(code, 1);
  assert.equal(client.ended, true);
  assert.ok(logs.length > 0);
  assert.doesNotMatch(logs.join("\n"), /fixture_password|postgresql:|bootstrap_test|127\.0\.0\.1/);
});

test("CLI success uses supplied environment, owns client lifecycle, and logs only the mode/timestamp", async () => {
  const client = new RecordingClient();
  const logs: string[] = [];
  const code = await subject().main({ argv: ["--local"], env: { DATABASE_URL: localUrl }, createClient: (config) => {
    assert.equal(config.host, "127.0.0.1");
    return client;
  }, logger: { log: (s) => logs.push(s), error: (s) => logs.push(s) } });
  assert.equal(code, 0);
  assert.equal(client.connected, true);
  assert.equal(client.ended, true);
  assert.match(logs.join("\n"), /baseline/i);
  assert.doesNotMatch(logs.join("\n"), /fixture_password|postgresql:|bootstrap_test|127\.0\.0\.1/);
});

test("committed baseline is complete, exactly the offline drizzle-kit export, and DDL only", () => {
  const sqlFile = path.join(root, "drizzle/bootstrap/baseline.sql");
  assert.ok(existsSync(sqlFile), "fresh bootstrap SQL must be generated, not replayed from broken history");
  const guardAndExport = `
    const fs = require('node:fs');
    const original = fs.readFileSync;
    fs.readFileSync = function (file, ...args) {
      if (/(^|[\\\\/])\\.env(?:[.\\\\/]|$)|drizzle\\.config\\./i.test(String(file))) throw new Error('environment/config read forbidden');
      return original.call(this, file, ...args);
    };
    require('node:net').Socket.prototype.connect = function () { throw new Error('network forbidden'); };
    const bin = require('node:path').join(require('node:path').dirname(require.resolve('drizzle-kit')), 'bin.cjs');
    process.argv = [process.execPath, bin, 'export', '--dialect=postgresql', '--schema=./src/db/schema.ts'];
    require(bin);
  `;
  const exported = execFileSync(process.execPath, ["-e", guardAndExport], { cwd: root, env: offlineEnv(), encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024 });
  const api = subject();
  const baseline = readFileSync(sqlFile, "utf8");
  assert.equal(api.normalizeText(baseline), api.normalizeText(exported), "schema/export changes require regenerating BOTH baseline SQL and metadata");
  assert.doesNotMatch(baseline, /^\s*(?:INSERT|UPDATE|DELETE|COPY|DO|DROP|GRANT|BEGIN|COMMIT|ROLLBACK)\b/gim);
  assert.doesNotMatch(baseline, /postgres(?:ql)?:\/\/|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|sk-[a-zA-Z0-9]{16,}/);
  assert.match(baseline, /"api_key" text DEFAULT '' NOT NULL/);
  assert.match(baseline, /"ark_api_key" text DEFAULT '' NOT NULL/);
  for (const name of ["site_settings", "announcements", "api_keys", "cards", "request_idempotency", "image_model_credit_costs"]) {
    assert.equal([...baseline.matchAll(new RegExp(`CREATE TABLE "${name}"`, "g"))].length, 1, name);
  }
});

test("metadata binds normalized schema + SQL hashes to the LAST current journal timestamp", () => {
  const api = subject();
  const artifacts = api.loadArtifacts();
  const schemaSource = readFileSync("src/db/schema.ts", "utf8");
  assert.doesNotThrow(() => api.validateArtifacts({ ...artifacts, schemaSource }));
  assert.equal(artifacts.metadata.journalLastTimestamp, artifacts.journal.entries.at(-1)!.when);
  assert.equal(artifacts.metadata.schemaSha256, api.normalizedHash(schemaSource));
  assert.equal(artifacts.metadata.sqlSha256, api.normalizedHash(artifacts.sql));
  assert.equal(api.baselineLedgerHash(artifacts), `baseline:v1:sha256:${artifacts.metadata.sqlSha256}`);
});

test("normalization ignores BOM/CRLF/trailing whitespace but schema semantics cannot drift", () => {
  const api = subject();
  assert.equal(api.normalizedHash("\uFEFFfirst  \r\nsecond\t\r\n\r\n"), api.normalizedHash("first\nsecond\n"));
  assert.notEqual(api.normalizedHash("first\nsecond"), api.normalizedHash("first\nchanged"));
  const artifacts = api.loadArtifacts();
  const schemaSource = readFileSync("src/db/schema.ts", "utf8");
  assert.throws(() => api.validateArtifacts({ ...artifacts, schemaSource: `${schemaSource}\nexport const newColumn = true;\n` }), /schema|baseline|hash/i);
});

test("SQL edits, stale journal metadata, unordered timestamps, and injected data statements fail closed", () => {
  const api = subject();
  const artifacts = api.loadArtifacts();
  const schemaSource = readFileSync("src/db/schema.ts", "utf8");
  const input = { ...artifacts, schemaSource };
  assert.throws(() => api.validateArtifacts({ ...input, sql: `${artifacts.sql}\n-- changed\n` }), /SQL|hash|baseline/i);
  assert.throws(() => api.validateArtifacts({ ...input, metadata: { ...artifacts.metadata, journalLastTimestamp: artifacts.metadata.journalLastTimestamp - 1 } }), /journal|timestamp/i);
  const journal = structuredClone(artifacts.journal);
  journal.entries[1].when = journal.entries[0].when;
  assert.throws(() => api.validateArtifacts({ ...input, journal }), /journal|timestamp/i);
  const injected = `${artifacts.sql}\nINSERT INTO "users" ("username") VALUES ('not-a-seed');\n`;
  assert.throws(() => api.validateArtifacts({ ...input, sql: injected, metadata: { ...artifacts.metadata, sqlSha256: api.normalizedHash(injected) } }), /DDL|data|SQL/i);
});
