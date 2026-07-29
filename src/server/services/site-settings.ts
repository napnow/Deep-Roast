import { eq } from "drizzle-orm";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { ApiError } from "@/server/http";

const UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "admin-contact",
);
const PUBLIC_PREFIX = "/uploads/admin-contact";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

async function ensureRow() {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1);
  if (rows[0]) return rows[0];
  const [row] = await db.insert(siteSettings).values({ id: 1 }).returning();
  return row!;
}

function mapSettings(row: typeof siteSettings.$inferSelect) {
  return {
    adminContactText: row.adminContactText ?? "",
    adminContactImagePath: row.adminContactImagePath ?? "",
    registrationEnabled: (row.registrationEnabled ?? 1) !== 0,
    updatedAt: row.updatedAt,
  };
}

export async function getSiteSettings() {
  const row = await ensureRow();
  return mapSettings(row);
}

export async function isRegistrationEnabled(): Promise<boolean> {
  const s = await getSiteSettings();
  return s.registrationEnabled;
}

export async function getPublicAdminContact() {
  const s = await getSiteSettings();
  return {
    text: s.adminContactText,
    imageUrl: s.adminContactImagePath ? s.adminContactImagePath : null,
    registrationEnabled: s.registrationEnabled,
  };
}

export async function updateAdminContactText(text: string) {
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({ adminContactText: text, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function setRegistrationEnabled(enabled: boolean) {
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({
      registrationEnabled: enabled ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function clearAdminContactImage() {
  const s = await getSiteSettings();
  if (s.adminContactImagePath) {
    const base = path.basename(s.adminContactImagePath);
    if (base && !base.includes("..")) {
      try {
        await unlink(path.join(UPLOAD_DIR, base));
      } catch {
        /* ignore missing */
      }
    }
  }
  const [row] = await db
    .update(siteSettings)
    .set({ adminContactImagePath: "", updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function saveAdminContactImage(
  data: Buffer,
  mime: string,
): Promise<{ adminContactImagePath: string }> {
  const ext = ALLOWED[mime];
  if (!ext) throw new ApiError("仅支持 PNG / JPEG / WebP 图片", 400);
  if (data.byteLength > MAX_BYTES) {
    throw new ApiError("图片不能超过 2MB", 400);
  }

  await ensureRow();
  await mkdir(UPLOAD_DIR, { recursive: true });

  const prev = await getSiteSettings();
  if (prev.adminContactImagePath) {
    const base = path.basename(prev.adminContactImagePath);
    if (base && !base.includes("..")) {
      try {
        await unlink(path.join(UPLOAD_DIR, base));
      } catch {
        /* ignore */
      }
    }
  }

  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), data);
  const publicPath = `${PUBLIC_PREFIX}/${filename}`;

  await db
    .update(siteSettings)
    .set({ adminContactImagePath: publicPath, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1));

  return { adminContactImagePath: publicPath };
}
