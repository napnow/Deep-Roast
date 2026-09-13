# Database bootstrap and incremental migrations

## Safety boundary

This repairs **repository rebuildability**, not the running production database.
Workspace: `C:/Users/ggggg/Documents/Codex/2026-09-12/ni-h-2/work/repair-project`.
No production connection, SSH, dump, schema/data modification, or ledger rewrite is needed or authorized by this task.
Real PostgreSQL acceptance is for **main's explicitly disposable local PostgreSQL instance**, native or Docker.
Do not target a production tunnel, a production-data restore, or a shared development database.

Historical SQL and `drizzle/meta/_journal.json` remain unchanged:

- The journal has 23 entries, ending at `0027_image_model_credit_costs`, timestamp `1789000000000`.
- `0001` / `0002` create `site_settings` / `announcements`; `0005` creates them again unconditionally.
- The journal omits older `0007`–`0011` files (including both `0010` files).
- A legitimate existing ledger has **20 rows**, not 23. Never fill gaps, recompute old hashes, reset its cursor, or replay applied SQL.
- Do not substitute `db:push`, edit old migrations, or use this baseline to patch a partial/unknown existing database.

## Entry point (package.json is owned by main)

Set exactly:

```json
"db:migrate": "node scripts/migrate-database.cjs"
```

Runtime: Node 22+, existing `pg` and `drizzle-orm`; no new dependency.
`drizzle-kit`, TypeScript and `tsx` are only used for offline regeneration/tests.
Ship the script, all historical SQL + journal, bootstrap SQL + metadata, and `src/db/schema.ts` (the hash input) if distributing a runnable migration checkout.
Artifact paths resolve relative to the script, not the caller's working directory.

`DATABASE_URL` comes only from the process. No `.env`, `.env.local`, Next env loader, `drizzle.config.ts`, or `--env-file` is loaded.
For this repair, always use `--local`:

```powershell
# Dummy local-fixture credentials only.
$env:DATABASE_URL = 'postgresql://bootstrap:bootstrap-local-only@127.0.0.1:55439/deep_roast_bootstrap_test'
node scripts/migrate-database.cjs --local
# Equivalent after main changes package.json:
npm run db:migrate -- --local
```

`--local` accepts only `127.0.0.1`, `::1`, or `localhost` (pinned to `127.0.0.1`, not DNS).
User, host and database must be explicit. General CLI port defaults to 5432; the **destructive acceptance fixture refuses that default port**.
Explicit pg fields prevent `PGHOST` / `PGPORT` redirects; an omitted password does not fall back to `PGPASSWORD` or a password file.
URL options including `host`, `hostaddr`, `options`, `sslcert` and `service` are refused.
Only `sslmode=disable|require|verify-full` is supported; `--local` requires `disable`.
Without `--local`, an explicitly supplied remote URL is possible for a separately authorized operator, **not this repair**.

`--help` does not read artifacts or connect. Logs expose only safe status/timestamp or locally authored refusal messages, never the URL, raw driver error, SQL, row data, nested cause or stack.
Failure exits nonzero; an incremental failure never falls back to bootstrap.

## Identification and transactions

Use one dedicated `pg.Client`, not a Pool or an already-open transaction.
The entry sets `search_path` to `public`, a 30-second lock timeout and a 120-second statement timeout.
A stable session advisory lock `(0x44524f41, 0x53544d47)` covers **inspection and all migration work**.
All concurrent migration callers must use this entry; direct `drizzle-kit migrate`, `db:push` and manual DDL do not participate in its lock.

| Observed database | Action |
| --- | --- |
| `public` exists; no namespace-dependent objects (including tables/views/sequences/types/functions/extensions); no other non-system schemas | Fresh baseline |
| Known ordinary project table/column signatures (`users`, `conversations`, `messages`, `llm_config`); valid ordinary `public.__drizzle_migrations`; known latest journal timestamp and recognizable hash format | Original Drizzle migrator |
| Missing public, another user schema, ledger only, empty/malformed ledger, future/unknown timestamp, ledger view/RLS or missing identity anchors | Refuse before DDL/DML |

An empty table or no information_schema tables is **not** an empty schema.
The catalog check counts namespace dependencies and conservatively refuses additional user schemas.
Recognized projects may have historical extra public objects; identity recognition is not a full schema-drift audit.
A recognized old project with broken *pending* history can still fail in the original migrator. Investigate separately; never stamp a fresh baseline onto it.

Fresh path: acquire session lock, **then** BEGIN/inspect; execute baseline; create the standard ledger (`id serial PRIMARY KEY`, `hash text NOT NULL`, `created_at bigint`); insert **one** parameterized marker; COMMIT; unlock. Schema DDL and marker are in the **same transaction**. Any failure rolls back both.
The lock-before-BEGIN ordering lets a waiter inspect the committed winner's schema.

```text
hash       = baseline:v1:sha256:<normalized baseline.sql SHA-256>
created_at = 1789000000000  # metadata.journalLastTimestamp, NOT wall-clock time
```

Drizzle applies only journal timestamps **greater** than the latest ledger `created_at`, so fresh bootstrap skips the unreplayable old history.
The incremental path uses the original `drizzle-orm/node-postgres/migrator`, `migrationsSchema: "public"`, `migrationsTable: "__drizzle_migrations"` and all historical files.
It commits the read-only preflight before Drizzle starts its own transaction; the **session** lock stays held, avoiding nested-BEGIN/early-commit mistakes.
No old ledger row is updated/deleted/replaced, and neither historical row count nor historical file-hash equality is required.
Old baseline markers remain recognizable after new journal entries and a refreshed baseline are added.

### Exported interface

Requiring `scripts/migrate-database.cjs` has no database side effects.

- `loadArtifacts(directory?)`: reads and validates schema/SQL hashes, metadata/journal alignment and historical-file presence. Returns `{ schemaSource, sql, metadata, journal, migrationsFolder }`; no database or schema execution.
- `validateArtifacts({ schemaSource, sql, metadata, journal })`: pure validation, including DDL-only vocabulary.
- `normalizeText(source)` / `normalizedHash(source)`: canonical text / SHA-256 used for both artifact hashes.
- `baselineLedgerHash(artifacts)`: explanatory ledger marker string.
- `classifyDatabase(snapshot, journal)` / `inspectDatabase(client)`: pure policy / catalog inspection.
- `migrateDatabase({ client, artifacts?, runDrizzle? })`: requires an already-connected **dedicated** client; validates artifacts before its first query; returns `{ mode: "baseline", timestamp }` or `{ mode: "incremental" }`. Optional `runDrizzle` is a test seam; default is the real migrator.
- The runner does not connect/end the supplied client. Real callers must `finally { await client.end(); }`, including lock/rollback/network failures.
- `main({ argv?, env?, createClient?, logger? })`: testable CLI; owns connect/end and returns exit code.

## Bootstrap asset generation / validation interface

Current inventory: **17 business tables, 11 foreign keys, 13 explicit secondary indexes**, plus PK/unique-constraint indexes.
SQL is DDL/default definitions only, with **no seed rows or secrets**. Key and base-URL defaults are empty; public model-name defaults are schema definitions.
Seeding is deliberately separate and is not executed here.

Metadata binds normalized `schema.ts` SHA-256, normalized SQL SHA-256, journal count/last tag/last timestamp, normalization version and generator provenance.
Normalization v1 removes a leading UTF-8 BOM, converts CRLF/CR to LF, removes trailing spaces/tabs, drops outer blank lines and adds one final LF. It does not collapse internal whitespace/literals.
Schema/source changes, SQL edits or a new journal entry require synchronizing the companion artifacts. The export-equality test prevents updating only hashes to conceal incomplete SQL.

**1. Generate SQL and metadata together, offline.** From the checkout root, after an intentional schema + **new** migration change, run this PowerShell block. It uses explicit `drizzle-kit export` flags, a whitelisted environment, and guards against network/env/config reads. Only the two bootstrap assets are written, UTF-8/LF:

```powershell
@'
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const api = require('./scripts/migrate-database.cjs');
const guardAndExport = `
  const fs = require('node:fs');
  const read = fs.readFileSync;
  fs.readFileSync = function(file, ...args) {
    if (/(^|[\\\\/])\\.env(?:[.\\\\/]|$)|drizzle\\.config\\./i.test(String(file))) throw new Error('env/config forbidden');
    return read.call(this, file, ...args);
  };
  require('node:net').Socket.prototype.connect = function() { throw new Error('network forbidden'); };
  const path = require('node:path');
  const bin = path.join(path.dirname(require.resolve('drizzle-kit')), 'bin.cjs');
  process.argv = [process.execPath, bin, 'export', '--dialect=postgresql', '--schema=./src/db/schema.ts'];
  require(bin);
`;
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP, TMP: process.env.TMP, TSX_DISABLE_CACHE: '1', NODE_ENV: 'test' };
const sql = api.normalizeText(execFileSync(process.execPath, ['-e', guardAndExport],
  { env, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 }));
const schemaSource = fs.readFileSync('src/db/schema.ts', 'utf8');
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
const last = journal.entries.at(-1);
const metadata = JSON.parse(fs.readFileSync('drizzle/bootstrap/metadata.json', 'utf8'));
const version = JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve('drizzle-kit')), 'package.json'), 'utf8')).version;
Object.assign(metadata, {
  schemaSha256: api.normalizedHash(schemaSource), sqlSha256: api.normalizedHash(sql),
  journalEntryCount: journal.entries.length, journalLastTag: last.tag, journalLastTimestamp: last.when,
  generator: 'drizzle-kit ' + version + ' export --dialect=postgresql --schema=./src/db/schema.ts'
});
api.validateArtifacts({ schemaSource, sql, metadata, journal });
fs.writeFileSync('drizzle/bootstrap/baseline.sql', sql, 'utf8');
fs.writeFileSync('drizzle/bootstrap/metadata.json', JSON.stringify(metadata, null, 2) + '\n', 'utf8');
'@ | node -
```

On Linux, run the same JavaScript with `node <<'NODE'` / `NODE`. It requires platform-correct `drizzle-kit` dependencies but **no database**.
Adding enums/functions/other exporter vocabulary requires explicitly reviewing/extending the DDL guard and tests, not weakening it or using `db:push`.
Regeneration affects **new empty databases only**. Existing projects keep applying new journal entries incrementally.

**2. Validate hashes, schema, journal and DDL policy without connecting:**

```powershell
node -e "const a=require('./scripts/migrate-database.cjs').loadArtifacts(); console.log('baseline verified at journal timestamp',a.metadata.journalLastTimestamp)"
```

This validation does not execute schema TypeScript or require drizzle-kit. It is also enforced automatically before migration connection/query work.

**3. Verify SQL completeness against a fresh offline export (not just hashes):**

```powershell
node --import tsx --test src/db/migration-bootstrap-artifacts.test.ts
```

The SQL must exactly match normalized offline export output, including every table/constraint/index. This test also rejects schema drift, stale timestamps and injected data statements.

## Offline verification and TDD evidence

With no PG acceptance opt-in variables set:

```powershell
node --import tsx --test src/db/migration-bootstrap.test.ts src/db/migration-bootstrap-artifacts.test.ts src/db/migrations-contract.test.ts
node --import tsx --test src/db/migration-bootstrap-postgres.test.ts # expected SKIP, no DB connection
node --check scripts/migrate-database.cjs
```

Evidence from this worker:

- **RED before implementation:** actual original Drizzle + offline DDL recorder hit `42P07: relation "announcements" already exists`; unrelated nonempty DB was not rejected before writes. All 21 initial new tests were RED.
- **Additional RED:** altered artifacts passed to the exported runner were accepted (`Missing expected rejection`); direct callers now have the same pre-query validation gate.
- **GREEN:** 25 new offline tests + 11 unchanged migration-contract tests = **36 passed**. Scope lint and type checks pass.
- **Next type regression RED/GREEN:** adding Next's global types reproduced both TS2769 errors at artifact-test lines 35/125. Explicit `offlineEnv(): NodeJS.ProcessEnv` fixes the `NODE_ENV` literal-union mismatch; Next-aware scoped tsc passes. Files remain LF.
- Windows Node `24.11.1` runs the installed Windows tsx/export stack. WSL Node `22.22.0` passes CJS syntax/help and all 14 core behavior tests using in-memory TypeScript transpilation, with no file/dependency changes. Full Node22 + tsx needs Linux esbuild instead of this Windows dependency junction; main owns platform-correct Linux validation.
- The offline recorder is **not** PostgreSQL. Real catalog/DDL/transaction/concurrency semantics remain for main's isolated PG acceptance. Main separately reported 363/363 Linux tests before the Next typing fix; that is not a claim of PG acceptance.

## Main: real local PostgreSQL acceptance (native or Docker)

These are **handoff instructions, not operations performed by this worker**.
Use a brand-new disposable instance/cluster, listening only on loopback, on a dedicated non-default port (examples: 55439), with database **`deep_roast_bootstrap_test`** and a fixture-only `bootstrap` role/password.
A native PostgreSQL instance prepared by main works unchanged; **Docker is not required**. Do not bypass isolation because Docker Hub is unavailable.

Optional Docker setup, only when the local engine/image is available (first verify context, unused port and unused container name; no host data volume):

```powershell
docker context show
docker run --name deep-roast-bootstrap-pg --label codex.disposable=migration-bootstrap --publish 127.0.0.1:55439:5432 --env POSTGRES_USER=bootstrap --env POSTGRES_PASSWORD=bootstrap-local-only --env POSTGRES_DB=deep_roast_bootstrap_test --detach postgres:16
docker exec deep-roast-bootstrap-pg pg_isready -U bootstrap -d deep_roast_bootstrap_test
```

Once native/Docker PG is ready, exercise the real CLI twice on that disposable DB:

```powershell
$env:DATABASE_URL = 'postgresql://bootstrap:bootstrap-local-only@127.0.0.1:55439/deep_roast_bootstrap_test'
node scripts/migrate-database.cjs --local # baseline
node scripts/migrate-database.cjs --local # incremental no-op
```

Using main's local psql connection, verify:

```sql
SELECT id, hash, created_at FROM public.__drizzle_migrations ORDER BY id;
-- Exactly one baseline:v1:sha256:... marker, created_at = 1789000000000.
```

Run the opt-in suite on **that same disposable DB only**. It repeatedly **drops/recreates public** and creates synthetic legacy rows; it never needs production data:

```powershell
$env:MIGRATION_BOOTSTRAP_TEST_URL = 'postgresql://bootstrap:bootstrap-local-only@127.0.0.1:55439/deep_roast_bootstrap_test'
$env:MIGRATION_BOOTSTRAP_TEST_ALLOW_RESET = 'yes-local-disposable'
node --import tsx --test src/db/migration-bootstrap-postgres.test.ts
# Remove opt-in immediately; ordinary test runs must remain non-destructive.
Remove-Item Env:\MIGRATION_BOOTSTRAP_TEST_URL
Remove-Item Env:\MIGRATION_BOOTSTRAP_TEST_ALLOW_RESET
Remove-Item Env:\DATABASE_URL
```

On Linux/WSL use the same values with `export NAME='value'` / `unset NAME`, and Node22 with Linux dependencies. Do not change the shared Windows junction just to run this suite.
The fixture refuses connection unless the acknowledgement is exact, `--local` validates the host, the database name is exact and the port is not 5432. It verifies `current_database()` before any reset. An ordinary `DATABASE_URL` alone does **not** enable this suite.

Acceptance checklist:

- [ ] Fresh CLI: all 17 current business tables, 11 FKs and 13 explicit indexes exist; every business table is empty; exactly one correct marker.
- [ ] Repeat: ledger and business data unchanged.
- [ ] Two independent concurrent pg connections: one baseline, one incremental outcome, one marker.
- [ ] Synthetic full legacy schema with **20 raw-hash ledger rows** ending at `1789000000000`: every row and sentinel user unchanged; no history replay.
- [ ] Synthetic preceding schema with only `0027` pending: append exactly one **ordinary Drizzle hash** row and create the missing table; old rows/sentinel unchanged. This pending fixture is intentionally tied to the reviewed journal tail and must be reviewed when that tail advances.
- [ ] Unrelated table, view, sequence, enum, function, additional user schema and ledger-only DB: refused without baseline/ledger additions.
- [ ] Injected ledger-write failure: no partial schema/ledger, no advisory lock afterward, clean retry succeeds.

Record results, then stop/remove only the verified disposable instance. For Docker, inspect `codex.disposable=migration-bootstrap` before removing that exact container/anonymous volume. Native cluster cleanup belongs to main's local environment owner.
**Do not run these tests or migration entry against production as part of release verification. No production schema or ledger change is required.**

### Existing tooling namespaces

A recognized public project with a valid public migration ledger may coexist with other namespaces, including the historical empty `drizzle.__drizzle_migrations` ledger. Incremental migration does not use or modify those namespaces. A fresh baseline still refuses databases containing any other user namespace.
