import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { ApiError, handleRoute } from "@/server/http";
import {
  assertSiteAssetKey,
  assertSiteAssetKind,
  siteAssetPath,
  siteAssetPublicPath,
} from "@/server/services/site-assets";

type Ctx = { params: Promise<{ kind: string; key: string }> };

function contentType(key: string) {
  if (/\.jpe?g$/i.test(key)) return "image/jpeg";
  if (/\.webp$/i.test(key)) return "image/webp";
  return "image/png";
}

export const GET = handleRoute(async (_req, ctx: Ctx) => {
  const params = await ctx.params;
  const kind = assertSiteAssetKind(params.kind);
  const key = assertSiteAssetKey(params.key);
  const expectedPath = siteAssetPublicPath(kind, key);
  const [settings] = await db
    .select({
      adminContactImagePath: siteSettings.adminContactImagePath,
      donationImagePath: siteSettings.donationImagePath,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);
  const associatedPath =
    kind === "contact"
      ? settings?.adminContactImagePath
      : settings?.donationImagePath;
  if (associatedPath !== expectedPath) {
    throw new ApiError("图片不存在", 404, "SITE_ASSET_NOT_FOUND");
  }

  let body: Buffer;
  try {
    body = await readFile(siteAssetPath(kind, key));
  } catch {
    throw new ApiError("图片不存在", 404, "SITE_ASSET_NOT_FOUND");
  }
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType(key),
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
