import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

export const root = path.resolve(".");
export const entryPath = path.join(root, "scripts/migrate-database.cjs");
export const requireFromRepo = createRequire(path.join(root, "package.json"));

export type Column = { name: string; type: string; notNull: boolean };
export type Table = { name: string; kind: string; rowSecurity: boolean; columns: Column[] };
export type LedgerRow = { id: number; hash: string; created_at: string | null };
export type Snapshot = {
  publicExists: boolean;
  publicObjectCount: number;
  otherSchemas: string[];
  tables: Table[];
  latestMigration: LedgerRow | null;
};
export type Artifacts = {
  schemaSource: string;
  sql: string;
  metadata: Record<string, unknown> & { journalLastTimestamp: number; sqlSha256: string };
  journal: { entries: { idx: number; tag: string; when: number }[] };
  migrationsFolder: string;
};
export type Entry = {
  classifyDatabase: (state: Snapshot, journal: Artifacts["journal"]) => "baseline" | "incremental";
  loadArtifacts: (directory?: string) => Artifacts;
  validateArtifacts: (input: { schemaSource: string; sql: string; metadata: unknown; journal: unknown }) => void;
  normalizedHash: (source: string) => string;
  normalizeText: (source: string) => string;
  baselineLedgerHash: (artifacts: Artifacts) => string;
  migrateDatabase: (options: { client: RecordingClient; artifacts?: Artifacts; runDrizzle?: (client: RecordingClient, config: Record<string, string>) => Promise<void> }) => Promise<{ mode: string; timestamp?: number }>;
  resolveConnectionConfig: (argv: string[], env: Record<string, string | undefined>) => Record<string, unknown>;
  main: (options: { argv: string[]; env: Record<string, string | undefined>; createClient?: (config: Record<string, unknown>) => RecordingClient; logger?: { log: (message: string) => void; error: (message: string) => void } }) => Promise<number>;
};

export function entry(): Entry | undefined {
  return existsSync(entryPath) ? requireFromRepo(entryPath) as Entry : undefined;
}

export function projectTables(): Table[] {
  const table = (name: string, fields: Record<string, string>): Table => ({
    name, kind: "r", rowSecurity: false,
    columns: Object.entries(fields).map(([name, type]) => ({ name, type, notNull: true })),
  });
  return [
    table("users", { id: "uuid", username: "text", password: "text" }),
    table("conversations", { id: "uuid", user_id: "uuid", title: "text" }),
    table("messages", { id: "uuid", conversation_id: "uuid", role: "text", content: "text" }),
    table("llm_config", { id: "int4", ark_api_key: "text", text_model: "text" }),
    { ...table("__drizzle_migrations", { id: "int4", hash: "text", created_at: "int8" }),
      columns: [
        { name: "id", type: "int4", notNull: true },
        { name: "hash", type: "text", notNull: true },
        { name: "created_at", type: "int8", notNull: false },
      ] },
  ];
}

export function emptySnapshot(): Snapshot {
  return { publicExists: true, publicObjectCount: 0, otherSchemas: [], tables: [], latestMigration: null };
}

export function legacySnapshot(timestamp = 1789000000000): Snapshot {
  return { ...emptySnapshot(), publicObjectCount: 5, tables: projectTables(),
    latestMigration: { id: 20, hash: "a".repeat(64), created_at: String(timestamp) } };
}

type SharedState = { tables: Table[]; ledger: LedgerRow[]; extraObjects: number; otherSchemas: string[]; publicExists: boolean; lock: Promise<void> };
export function databaseState(snapshot = emptySnapshot()): SharedState {
  return { tables: structuredClone(snapshot.tables), ledger: snapshot.latestMigration ? [structuredClone(snapshot.latestMigration)] : [],
    extraObjects: Math.max(0, snapshot.publicObjectCount - snapshot.tables.length),
    otherSchemas: [...snapshot.otherSchemas], publicExists: snapshot.publicExists, lock: Promise.resolve() };
}

// A catalog/transaction recorder, NOT a PostgreSQL emulator. Only CREATE TABLE
// duplication is modeled to expose the existing history bug without a database.
// PostgreSQL constraint/default/index semantics must be checked by main in Docker.
export class RecordingClient {
  readonly calls: { text: string; values: unknown[] }[] = [];
  connected = false;
  ended = false;
  failOn?: RegExp;
  private backup?: { tables: Table[]; ledger: LedgerRow[] };
  private unlock?: () => void;
  constructor(readonly state = databaseState()) {}
  async connect() { this.connected = true; }
  async end() { this.ended = true; this.unlock?.(); }

  async query(query: string | { text: string; rowMode?: string }, values: unknown[] = []): Promise<{ rows: unknown[]; rowCount: number }> {
    const text = (typeof query === "string" ? query : query.text).trim();
    this.calls.push({ text, values });
    if (this.failOn?.test(text)) throw Object.assign(new Error("fixture database failure"), { code: "XX000" });
    const result = (rows: Record<string, unknown>[] = []) => ({
      rows: typeof query !== "string" && query.rowMode === "array" ? rows.map(Object.values) : rows,
      rowCount: rows.length,
    });
    if (/pg_advisory_unlock\(/i.test(text)) { this.unlock?.(); this.unlock = undefined; return result([{ unlocked: true }]); }
    if (/pg_advisory_lock\(/i.test(text)) {
      const previous = this.state.lock;
      this.state.lock = new Promise<void>((resolve) => { this.unlock = resolve; });
      await previous;
      return result();
    }
    if (/^begin\b/i.test(text)) { this.backup = structuredClone({ tables: this.state.tables, ledger: this.state.ledger }); return result(); }
    if (/^rollback\b/i.test(text)) {
      if (this.backup) { this.state.tables = this.backup.tables; this.state.ledger = this.backup.ledger; }
      this.backup = undefined; return result();
    }
    if (/^commit\b/i.test(text)) { this.backup = undefined; return result(); }
    if (text.includes("migration-bootstrap:namespace")) return result([{
      public_exists: this.state.publicExists,
      public_object_count: this.state.tables.length + this.state.extraObjects,
      other_schemas: this.state.otherSchemas,
    }]);
    if (text.includes("migration-bootstrap:tables")) return result(this.state.tables.map((t) => ({ ...t })));
    if (/^select\b/i.test(text) && text.includes("__drizzle_migrations")) {
      const row = [...this.state.ledger].sort((a, b) => Number(b.created_at) - Number(a.created_at))[0];
      return result(row ? [{ id: row.id, hash: row.hash, created_at: row.created_at }] : []);
    }
    for (const match of text.matchAll(/CREATE TABLE\s+(IF NOT EXISTS\s+)?(?:"public"\.)?"([^"]+)"\s*\(([\s\S]*?)\);/gi)) {
      const [, idempotent, name, body] = match;
      if (this.state.tables.some((t) => t.name === name)) {
        if (idempotent) continue;
        throw Object.assign(new Error(`relation "${name}" already exists`), { code: "42P07" });
      }
      const types: Record<string, string> = { integer: "int4", serial: "int4", bigint: "int8" };
      const columns = [...body.matchAll(/^\s*"([^"]+)"\s+(uuid|text|integer|serial|bigint|boolean|timestamp|jsonb)([^\n]*)/gmi)].map((column) => ({
        name: column[1], type: types[column[2].toLowerCase()] ?? column[2].toLowerCase(), notNull: /NOT NULL|PRIMARY KEY/i.test(column[3]),
      }));
      this.state.tables.push({ name, kind: "r", rowSecurity: false, columns });
    }
    if (/^insert into\s+(?:"public"\.)?"__drizzle_migrations"/i.test(text)) {
      this.state.ledger.push({ id: Math.max(0, ...this.state.ledger.map((r) => r.id)) + 1,
        hash: String(values[0]), created_at: String(values[1]) });
    }
    return result();
  }
}

export async function runCurrentEntry(client: RecordingClient) {
  const subject = entry();
  if (subject) return subject.migrateDatabase({ client });
  // Before the new entry exists, exercise the ACTUAL existing Drizzle migrator.
  // This fallback is only for the initial RED, not an alternative implementation.
  await migrate(drizzle(client as never), {
    migrationsFolder: path.join(root, "drizzle"), migrationsSchema: "public", migrationsTable: "__drizzle_migrations",
  });
  return { mode: "incremental" };
}
