import { and, eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
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
import {
  assertLegacyImageKey,
  assertStorageKey,
  privateImagePath,
  privateImageRoot,
  privateThumbnailPath,
  verifyImageAccessToken,
} from "@/server/services/private-images";

type Ctx = { params: Promise<{ key: string }> };

function imageContentType(key: string): string {
  if (/\.jpe?g$/i.test(key)) return "image/jpeg";
  if (/\.webp$/i.test(key)) return "image/webp";
  return "image/png";
}

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

  let body: Buffer;
  try {
    body = await readFile(filePath);
  } catch {
    if (record && useThumb) {
      body = await readFile(privateImagePath(privateImageRoot(), key));
    } else {
      throw new ApiError("Image not found", 404, "IMAGE_NOT_FOUND");
    }
  }

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": useThumb ? "image/webp" : imageContentType(key),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
