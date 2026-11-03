import { sql } from "drizzle-orm";
import type { NodePgTransaction } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type * as schema from "@/db/schema";

type Transaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;

/** Serialize cleanup and registration before either reads risk data. */
export async function lockRegistrationCleanup(tx: Transaction): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(1146244935, 1380275026)`);
}
