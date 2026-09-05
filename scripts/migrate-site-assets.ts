import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { siteSettings } from "../src/db/schema";
import {
  removeSiteAsset,
  saveSiteAsset,
  type SiteAssetKind,
} from "../src/server/services/site-assets";

const legacyPublicDir = process.env.DEEPROAST_LEGACY_PUBLIC_DIR?.trim();

function mimeForPath(value: string): string | null {
  if (/\.png$/i.test(value)) return "image/png";
  if (/\.jpe?g$/i.test(value)) return "image/jpeg";
  if (/\.webp$/i.test(value)) return "image/webp";
  return null;
}

async function migrateOne(
  kind: SiteAssetKind,
  oldPublicPath: string | null,
): Promise<boolean> {
  const oldPrefix =
    kind === "contact" ? "/uploads/admin-contact/" : "/uploads/donation/";
  if (!legacyPublicDir || !oldPublicPath?.startsWith(oldPrefix)) return false;
  const key = path.basename(oldPublicPath);
  if (!/^[^/\\]+\.(?:png|jpe?g|webp)$/i.test(key)) return false;
  const mime = mimeForPath(key);
  if (!mime) return false;

  const sourcePath = path.join(
    legacyPublicDir,
    kind === "contact" ? "admin-contact" : "donation",
    key,
  );
  const newPublicPath = await saveSiteAsset(kind, await readFile(sourcePath), mime);
  try {
    const updated =
      kind === "contact"
        ? await db
            .update(siteSettings)
            .set({ adminContactImagePath: newPublicPath, updatedAt: new Date() })
            .where(
              and(
                eq(siteSettings.id, 1),
                eq(siteSettings.adminContactImagePath, oldPublicPath),
              ),
            )
            .returning({ id: siteSettings.id })
        : await db
            .update(siteSettings)
            .set({ donationImagePath: newPublicPath, updatedAt: new Date() })
            .where(
              and(
                eq(siteSettings.id, 1),
                eq(siteSettings.donationImagePath, oldPublicPath),
              ),
            )
            .returning({ id: siteSettings.id });
    if (updated.length === 0) {
      await removeSiteAsset(kind, newPublicPath);
      return false;
    }
    return true;
  } catch (error) {
    await removeSiteAsset(kind, newPublicPath).catch(() => undefined);
    throw error;
  }
}

async function main() {
  if (!legacyPublicDir) {
    console.log("No legacy public directory configured; nothing to migrate");
    return;
  }
  const [settings] = await db
    .select({
      adminContactImagePath: siteSettings.adminContactImagePath,
      donationImagePath: siteSettings.donationImagePath,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);
  if (!settings) {
    console.log("No site settings row; nothing to migrate");
    return;
  }

  const contact = await migrateOne("contact", settings.adminContactImagePath);
  const donation = await migrateOne("donation", settings.donationImagePath);
  console.log(`Site assets migrated: contact=${contact}, donation=${donation}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Site asset migration failed", error);
    process.exit(1);
  });
