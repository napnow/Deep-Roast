import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type {
  NodePgDatabase,
  NodePgTransaction,
} from "drizzle-orm/node-postgres";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  conversations,
  imageGenerations,
  registrationRecords,
  users,
} from "@/db/schema";
import type {
  CleanupCandidate,
  CleanupPreview,
  CleanupResult,
} from "@/types";
import {
  assertStorageKey,
  privateImagePath,
  privateImageRoot,
  privateThumbnailPath,
} from "@/server/services/private-images";
import {
  getLastActivityAt,
  getStaleUserCutoff,
  isStaleUser,
  type ActivityTimestamps,
} from "./stale-user-activity";

type Schema = typeof schema;
type DatabaseTransaction = NodePgTransaction<
  Schema,
  ExtractTablesWithRelations<Schema>
>;
type DatabaseClient = NodePgDatabase<Schema> | DatabaseTransaction;

export interface UserActivityRow extends ActivityTimestamps {
  id: string;
  username: string;
  role: string;
  status: string;
  cleanupProtected: boolean;
  conversationCount: number;
  imageCount: number;
}

interface ImageArtifact {
  imageUrl: string;
  storageKey: string | null;
  thumbStorageKey: string | null;
}

export function filterStaleUserCandidates(
  rows: UserActivityRow[],
  cutoff: Date,
): CleanupCandidate[] {
  return rows
    .filter(
      (row) =>
        row.role === "user" &&
        !row.cleanupProtected &&
        isStaleUser(row, cutoff),
    )
    .map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role,
      status: row.status,
      createdAt: row.createdAt
        ? new Date(String(row.createdAt)).toISOString()
        : null,
      lastActivityAt: getLastActivityAt(row).toISOString(),
      conversationCount: row.conversationCount,
      imageCount: row.imageCount,
    }));
}

export async function loadUserActivityRows(
  client: DatabaseClient,
  ids?: string[],
): Promise<UserActivityRow[]> {
  if (ids && ids.length === 0) return [];

  const userFilter = ids ? inArray(users.id, ids) : undefined;
  const cleanupFilter = eq(users.cleanupProtected, false);

  return client
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      status: users.status,
      cleanupProtected: users.cleanupProtected,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      latestConversationAt: sql<Date | null>`(
        SELECT ${conversations.updatedAt}
        FROM ${conversations}
        WHERE ${conversations.userId} = ${users.id}
        ORDER BY ${conversations.updatedAt} DESC NULLS LAST
        LIMIT 1
      )`,
      latestImageAt: sql<Date | null>`(
        SELECT ${imageGenerations.createdAt}
        FROM ${imageGenerations}
        WHERE ${imageGenerations.userId} = ${users.id}
        ORDER BY ${imageGenerations.createdAt} DESC NULLS LAST
        LIMIT 1
      )`,
      conversationCount: sql<number>`(
        SELECT count(*)::int
        FROM ${conversations}
        WHERE ${conversations.userId} = ${users.id}
      )`,
      imageCount: sql<number>`(
        SELECT count(*)::int
        FROM ${imageGenerations}
        WHERE ${imageGenerations.userId} = ${users.id}
      )`,
    })
    .from(users)
    .where(userFilter ? and(userFilter, cleanupFilter) : cleanupFilter)
    .orderBy(asc(users.id));
}

export async function lockUserRows(
  tx: DatabaseTransaction,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];

  const lockedRows = await tx
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.id, ids),
        eq(users.role, "user"),
        eq(users.cleanupProtected, false),
      ),
    )
    .orderBy(asc(users.id))
    .for("update");

  return lockedRows.map((row) => row.id);
}

export async function previewStaleUsers(
  now = new Date(),
): Promise<CleanupPreview> {
  const cutoff = getStaleUserCutoff(now);
  const rows = await loadUserActivityRows(db);
  const candidates = filterStaleUserCandidates(rows, cutoff);

  return {
    cutoff: cutoff.toISOString(),
    total: candidates.length,
    candidates,
  };
}

export async function cleanupStaleUsers(
  now = new Date(),
): Promise<CleanupResult> {
  const cutoff = getStaleUserCutoff(now);
  const cleanup = await db.transaction(async (tx) => {
    const snapshot = await loadUserActivityRows(tx);
    const snapshotCandidates = filterStaleUserCandidates(snapshot, cutoff);
    const snapshotIds = snapshotCandidates.map((candidate) => candidate.id);
    const lockedIds = await lockUserRows(tx, snapshotIds);
    const lockedRows = lockedIds.length
      ? await loadUserActivityRows(tx, lockedIds)
      : [];
    const candidates = filterStaleUserCandidates(lockedRows, cutoff);
    const ids = candidates.map((candidate) => candidate.id);
    const usernames = candidates.map((candidate) => candidate.username);
    const images = ids.length
      ? await tx
          .select({
            imageUrl: imageGenerations.imageUrl,
            storageKey: imageGenerations.storageKey,
            thumbStorageKey: imageGenerations.thumbStorageKey,
          })
          .from(imageGenerations)
          .where(inArray(imageGenerations.userId, ids))
      : [];

    if (ids.length) {
      await tx.delete(users).where(
        and(
          inArray(users.id, ids),
          eq(users.role, "user"),
          eq(users.cleanupProtected, false),
        ),
      );
      await tx
        .delete(registrationRecords)
        .where(inArray(registrationRecords.username, usernames));
    }

    return {
      candidates,
      images,
    };
  });

  const imageCleanupFailures = await removeImageFiles(cleanup.images);
  return {
    cutoff: cutoff.toISOString(),
    deleted: cleanup.candidates.length,
    users: cleanup.candidates.map((candidate) => candidate.username),
    imageCleanupFailures,
  };
}

async function removeImageFiles(images: ImageArtifact[]): Promise<number> {
  let failures = 0;
  const root = privateImageRoot();

  for (const image of images) {
    const targets = new Set<string>();
    if (image.storageKey) {
      try {
        targets.add(privateImagePath(root, image.storageKey));
        targets.add(
          image.thumbStorageKey
            ? path.join(root, "thumbs", assertStorageKey(image.thumbStorageKey))
            : privateThumbnailPath(root, image.storageKey),
        );
      } catch {
        failures += 1;
        continue;
      }
    } else {
      const legacy = /^\/?images\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp))$/i.exec(
        image.imageUrl,
      );
      if (!legacy) continue;
      const filename = legacy[1];
      targets.add(path.join(process.cwd(), "public", "images", filename));
      targets.add(
        path.join(
          process.cwd(),
          "public",
          "images",
          "thumbs",
          filename.replace(/\.(png|jpe?g)$/i, ".webp"),
        ),
      );
    }

    for (const targetPath of targets) {
      try {
        await unlink(targetPath);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") failures += 1;
      }
    }
  }

  return failures;
}
