import { eq } from "drizzle-orm";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { ApiError } from "@/server/http";
import { assertImageGenerationPolicy } from "./image-generation-access";
import { parseInvitationReward } from "./invitations";

const UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "admin-contact",
);
const PUBLIC_PREFIX = "/uploads/admin-contact";

const DONATION_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "donation",
);
const DONATION_PUBLIC_PREFIX = "/uploads/donation";
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
    imageGenerationEnabled: (row.imageGenerationEnabled ?? 1) !== 0,
    donationEnabled: (row.donationEnabled ?? 1) !== 0,
    donationImagePath: row.donationImagePath ?? "",
    donationText: row.donationText ?? "",
    invitationEnabled: (row.invitationEnabled ?? 1) !== 0,
    invitationReward: row.invitationReward ?? 200,
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

export async function isImageGenerationEnabled(): Promise<boolean> {
  const settings = await getSiteSettings();
  return settings.imageGenerationEnabled;
}

export async function assertImageGenerationAllowed(
  role: string,
): Promise<void> {
  assertImageGenerationPolicy(role, await isImageGenerationEnabled());
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

export async function setImageGenerationEnabled(enabled: boolean) {
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({
      imageGenerationEnabled: enabled ? 1 : 0,
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

// ── 打赏（donation）──

export async function getPublicDonation() {
  const s = await getSiteSettings();
  return {
    enabled: s.donationEnabled,
    imageUrl: s.donationImagePath ? s.donationImagePath : null,
    text: s.donationText,
  };
}

export async function setDonationEnabled(enabled: boolean) {
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({
      donationEnabled: enabled ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function setInvitationEnabled(enabled: boolean) {
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({
      invitationEnabled: enabled ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function setInvitationReward(value: unknown) {
  const reward = parseInvitationReward(value);
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({ invitationReward: reward, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function updateDonationText(text: string) {
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({ donationText: text, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function clearDonationImage() {
  const s = await getSiteSettings();
  if (s.donationImagePath) {
    const base = path.basename(s.donationImagePath);
    if (base && !base.includes("..")) {
      try {
        await unlink(path.join(DONATION_UPLOAD_DIR, base));
      } catch {
        /* ignore missing */
      }
    }
  }
  const [row] = await db
    .update(siteSettings)
    .set({ donationImagePath: "", updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function saveDonationImage(
  data: Buffer,
  mime: string,
): Promise<{ donationImagePath: string }> {
  const ext = ALLOWED[mime];
  if (!ext) throw new ApiError("仅支持 PNG / JPEG / WebP 图片", 400);
  if (data.byteLength > MAX_BYTES) {
    throw new ApiError("图片不能超过 2MB", 400);
  }

  await ensureRow();
  await mkdir(DONATION_UPLOAD_DIR, { recursive: true });

  const prev = await getSiteSettings();
  if (prev.donationImagePath) {
    const base = path.basename(prev.donationImagePath);
    if (base && !base.includes("..")) {
      try {
        await unlink(path.join(DONATION_UPLOAD_DIR, base));
      } catch {
        /* ignore */
      }
    }
  }

  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(DONATION_UPLOAD_DIR, filename), data);
  const publicPath = `${DONATION_PUBLIC_PREFIX}/${filename}`;

  await db
    .update(siteSettings)
    .set({ donationImagePath: publicPath, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1));

  return { donationImagePath: publicPath };
}
