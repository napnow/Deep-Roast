import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type {
  NodePgDatabase,
  NodePgTransaction,
} from "drizzle-orm/node-postgres";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { imageGenerations, users } from "@/db/schema";
import type {
  ImageCleanupPreview,
  ImageCleanupResult,
} from "@/types";
import {
  assertLegacyImageKey,
  assertStorageKey,
  privateImageRoot,
} from "./private-images";

type Schema = typeof schema;
type DatabaseTransaction = NodePgTransaction<
  Schema,
  ExtractTablesWithRelations<Schema>
>;
type DatabaseClient = NodePgDatabase<Schema> | DatabaseTransaction;

export interface ImageCleanupRow {
  id: string;
  userId: string;
  role: string;
  imageUrl: string;
  storageKey: string | null;
  thumbStorageKey: string | null;
}

export type ImageCleanupArtifactKind =
  | "private"
  | "private-thumbnail"
  | "legacy"
  | "legacy-thumbnail";

export interface ImageCleanupArtifact {
  kind: ImageCleanupArtifactKind;
  path: string;
  root: string;
}

export interface ImageCleanupRoots {
  privateRoot: string;
  publicRoot: string;
}

const storageKeyColumn = sql<string | null>`"image_generations"."storage_key"`;
const thumbStorageKeyColumn = sql<string | null>`"image_generations"."thumb_storage_key"`;

function defaultRoots(): ImageCleanupRoots {
  return {
    privateRoot: privateImageRoot(),
    publicRoot: path.join(process.cwd(), "public"),
  };
}

function isPathInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  );
}

function privateArtifact(
  key: string,
  roots: ImageCleanupRoots,
  kind: "private" | "private-thumbnail",
): ImageCleanupArtifact | null {
  try {
    const safeKey = assertStorageKey(key);
    const root = path.resolve(roots.privateRoot);
    const target = path.resolve(
      root,
      kind === "private-thumbnail" ? "thumbs" : "",
      safeKey,
    );
    if (!isPathInside(root, target)) return null;
    return { kind, path: target, root };
  } catch {
    return null;
  }
}

function legacyArtifacts(
  imageUrl: string,
  roots: ImageCleanupRoots,
): ImageCleanupArtifact[] {
  const match = /^\/images\/([^/\\]+)$/i.exec(imageUrl);
  if (!match) return [];

  try {
    const key = assertLegacyImageKey(match[1]);
    const root = path.resolve(roots.publicRoot);
    const imagePath = path.resolve(root, "images", key);
    const thumbnailKey = key.replace(/\.(png|jpe?g)$/i, ".webp");
    const thumbnailPath = path.resolve(root, "images", "thumbs", thumbnailKey);
    if (!isPathInside(root, imagePath) || !isPathInside(root, thumbnailPath)) {
      return [];
    }
    return [
      { kind: "legacy", path: imagePath, root },
      { kind: "legacy-thumbnail", path: thumbnailPath, root },
    ];
  } catch {
    return [];
  }
}

export function filterImageCleanupRows<T extends { role?: string }>(
  rows: T[],
): T[] {
  return rows.filter((row) => row.role === "user");
}

export function resolveImageCleanupArtifacts(
  row: Pick<
    ImageCleanupRow,
    "imageUrl" | "storageKey" | "thumbStorageKey"
  >,
  roots: ImageCleanupRoots = defaultRoots(),
): ImageCleanupArtifact[] {
  if (row.storageKey || row.thumbStorageKey) {
    const artifacts: ImageCleanupArtifact[] = [];
    if (row.storageKey) {
      const artifact = privateArtifact(row.storageKey, roots, "private");
      if (artifact) artifacts.push(artifact);
    }
    if (row.thumbStorageKey) {
      const artifact = privateArtifact(
        row.thumbStorageKey,
        roots,
        "private-thumbnail",
      );
      if (artifact) artifacts.push(artifact);
    }
    return artifacts;
  }

  return legacyArtifacts(row.imageUrl, roots);
}

function uniqueArtifacts(rows: ImageCleanupRow[]): ImageCleanupArtifact[] {
  const artifacts = rows.flatMap((row) => resolveImageCleanupArtifacts(row));
  const seen = new Set<string>();
  return artifacts.filter((artifact) => {
    if (seen.has(artifact.path)) return false;
    seen.add(artifact.path);
    return true;
  });
}

async function loadImageCleanupRows(
  client: DatabaseClient,
  userIds?: string[],
): Promise<ImageCleanupRow[]> {
  if (userIds && userIds.length === 0) return [];

  const userFilter = userIds
    ? and(eq(users.role, "user"), inArray(users.id, userIds))
    : eq(users.role, "user");

  return client
    .select({
      id: imageGenerations.id,
      userId: imageGenerations.userId,
      role: users.role,
      imageUrl: imageGenerations.imageUrl,
      storageKey: storageKeyColumn,
      thumbStorageKey: thumbStorageKeyColumn,
    })
    .from(imageGenerations)
    .innerJoin(users, eq(users.id, imageGenerations.userId))
    .where(userFilter)
    .orderBy(asc(imageGenerations.id));
}

async function summarizeImageCleanupRows(
  rows: ImageCleanupRow[],
  artifacts = uniqueArtifacts(rows),
): Promise<ImageCleanupPreview & { artifacts: ImageCleanupArtifact[] }> {
  let estimatedBytes = 0;
  for (const artifact of artifacts) {
    try {
      const details = await stat(artifact.path);
      if (details.isFile()) estimatedBytes += details.size;
    } catch {
      // Missing or unreadable files do not prevent the preview.
    }
  }

  return {
    userCount: new Set(rows.map((row) => row.userId)).size,
    imageCount: rows.length,
    artifactCount: artifacts.length,
    estimatedBytes,
    artifacts,
  };
}

function toPreview(
  summary: ImageCleanupPreview & { artifacts: ImageCleanupArtifact[] },
): ImageCleanupPreview {
  return {
    userCount: summary.userCount,
    imageCount: summary.imageCount,
    artifactCount: summary.artifactCount,
    estimatedBytes: summary.estimatedBytes,
  };
}

async function removeImageArtifacts(artifacts: ImageCleanupArtifact[]) {
  let deletedArtifacts = 0;
  let fileCleanupFailures = 0;

  for (const artifact of artifacts) {
    if (!isPathInside(artifact.root, artifact.path)) {
      fileCleanupFailures += 1;
      continue;
    }

    try {
      await unlink(artifact.path);
      deletedArtifacts += 1;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        fileCleanupFailures += 1;
      }
    }
  }

  return { deletedArtifacts, fileCleanupFailures };
}

export async function previewImageCleanup(): Promise<ImageCleanupPreview> {
  const rows = await loadImageCleanupRows(db);
  const summary = await summarizeImageCleanupRows(rows);
  return toPreview(summary);
}

export async function cleanupImages(): Promise<ImageCleanupResult> {
  const rows = await db.transaction(async (tx) => {
    const userRows = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "user"))
      .for("update");
    const snapshot = await loadImageCleanupRows(
      tx,
      userRows.map((row) => row.id),
    );

    if (snapshot.length > 0) {
      await tx
        .delete(imageGenerations)
        .where(inArray(imageGenerations.id, snapshot.map((row) => row.id)));
    }

    return snapshot;
  });

  const summary = await summarizeImageCleanupRows(rows);
  const fileResult = await removeImageArtifacts(summary.artifacts);
  return { ...toPreview(summary), ...fileResult, deletedRecords: rows.length };
}
