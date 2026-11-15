import { and, eq } from "drizzle-orm";
import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import { imageGenerations } from "@/db/schema";
import {
  requireActiveAdmin,
  requireActiveUser,
  requireApiUser,
  type RequestUser,
} from "@/server/auth";
import { ApiError, handleRoute } from "@/server/http";
import { imageResponse } from "@/server/services/image-response";
import {
  assertLegacyImageKey,
  assertStorageKey,
  privateImagePath,
  privateImageRoot,
  privateThumbnailPath,
  verifyImageAccessToken,
} from "@/server/services/private-images";

type Ctx = { params: Promise<{ key: string }> };

async function resolveUser(req: Request): Promise<RequestUser> {
  if (req.headers.get("authorization")) return requireApiUser(req);
  return requireActiveUser(req);
}

export const GET = handleRoute(async (req, ctx: Ctx) => {
  const { key: rawKey } = await ctx.params;
  let key: string;
  let isPrivateStorageKey = true;
  try {
    key = assertStorageKey(rawKey);
  } catch {
    isPrivateStorageKey = false;
    key = assertLegacyImageKey(rawKey);
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const owner = url.searchParams.get("owner");
  let userId: string;

  if (token) {
    userId = url.searchParams.get("user") || "";
    if (
      !isPrivateStorageKey ||
      !userId ||
      !verifyImageAccessToken(token, key, userId)
    ) {
      throw new ApiError("Image authorization failed", 403, "IMAGE_ACCESS_DENIED");
    }
  } else if (owner !== null) {
    await requireActiveAdmin(req);
    userId = owner.trim();
    if (!userId) {
      throw new ApiError("Image owner is required", 400, "INVALID_IMAGE_OWNER");
    }
  } else {
    userId = (await resolveUser(req)).userId;
  }

  const [record] = isPrivateStorageKey
    ? await db
        .select({
          id: imageGenerations.id,
          storageKey: imageGenerations.storageKey,
          imageUrl: imageGenerations.imageUrl,
        })
        .from(imageGenerations)
        .where(
          and(
            eq(imageGenerations.userId, userId),
            eq(imageGenerations.storageKey, key),
          ),
        )
        .limit(1)
    : [];

  const [legacyRecord] = !record
    ? await db
        .select({ id: imageGenerations.id, imageUrl: imageGenerations.imageUrl })
        .from(imageGenerations)
        .where(
          and(
            eq(imageGenerations.userId, userId),
            eq(imageGenerations.imageUrl, `/images/${key}`),
          ),
        )
        .limit(1)
    : [];
  if (token && !record) {
    throw new ApiError("Image authorization failed", 403, "IMAGE_ACCESS_DENIED");
  }
  if (!record && !legacyRecord) {
    throw new ApiError("Image not found", 404, "IMAGE_NOT_FOUND");
  }

  const useThumb = url.searchParams.get("thumb") === "1";
  const filePath = record
    ? useThumb
      ? privateThumbnailPath(privateImageRoot(), key)
      : privateImagePath(privateImageRoot(), key)
    : path.join(
        process.cwd(),
        "public",
        "images",
        useThumb ? "thumbs" : "",
        useThumb ? key.replace(/\.(png|jpe?g)$/i, ".webp") : key,
      );

  const download = url.searchParams.get("download");
  if (download === "check" && !useThumb) {
    let handle;
    try {
      handle = await open(filePath, "r");
      const header = Buffer.alloc(12);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      return imageResponse(header.subarray(0, bytesRead), key, false, true, true);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Image not found", 404, "IMAGE_NOT_FOUND");
    } finally {
      await handle?.close();
    }
  }

  let body: Buffer;
  let servedThumb = useThumb;
  try {
    body = await readFile(filePath);
  } catch {
    if (record && useThumb) {
      body = await readFile(privateImagePath(privateImageRoot(), key));
      servedThumb = false;
    } else {
      throw new ApiError("Image not found", 404, "IMAGE_NOT_FOUND");
    }
  }

  return imageResponse(body, key, servedThumb, false);
});
