import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { assertImageGenerationPolicy } from "./image-generation-access";
import { parseInvitationReward } from "./invitations";
import type { InvitationSettingsPatch } from "./invitation-settings-input";
import { parseCheckinReward } from "./checkin-settings-input";
import { removeSiteAsset, saveSiteAsset } from "./site-assets";

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
    registrationIpLimitEnabled: (row.registrationIpLimitEnabled ?? 1) !== 0,
    imageGenerationEnabled: (row.imageGenerationEnabled ?? 1) !== 0,
    checkinReward: row.checkinReward ?? 50,
    donationEnabled: (row.donationEnabled ?? 1) !== 0,
    donationImagePath: row.donationImagePath ?? "",
    donationText: row.donationText ?? "",
    invitationEnabled: (row.invitationEnabled ?? 1) !== 0,
    invitationReward: row.invitationReward ?? 200,
    invitationInviteeReward: row.invitationInviteeReward ?? 50,
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

export async function getCheckinReward(): Promise<number> {
  const settings = await getSiteSettings();
  return settings.checkinReward;
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

export async function setRegistrationIpLimitEnabled(enabled: boolean) {
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({
      registrationIpLimitEnabled: enabled ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function clearAdminContactImage() {
  const s = await getSiteSettings();
  const [row] = await db
    .update(siteSettings)
    .set({ adminContactImagePath: "", updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  await removeSiteAsset("contact", s.adminContactImagePath).catch((error) =>
    console.error("Failed to remove replaced contact image", error),
  );
  return mapSettings(row!);
}

export async function saveAdminContactImage(
  data: Buffer,
  mime: string,
): Promise<{ adminContactImagePath: string }> {
  await ensureRow();
  const prev = await getSiteSettings();
  const publicPath = await saveSiteAsset("contact", data, mime);
  try {
    await db
      .update(siteSettings)
      .set({ adminContactImagePath: publicPath, updatedAt: new Date() })
      .where(eq(siteSettings.id, 1));
  } catch (error) {
    await removeSiteAsset("contact", publicPath).catch(() => undefined);
    throw error;
  }
  await removeSiteAsset("contact", prev.adminContactImagePath).catch((error) =>
    console.error("Failed to remove replaced contact image", error),
  );

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

export async function updateInvitationSettings(patch: InvitationSettingsPatch) {
  await ensureRow();
  const values: Partial<typeof siteSettings.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.invitationEnabled !== undefined) {
    values.invitationEnabled = patch.invitationEnabled ? 1 : 0;
  }
  if (patch.invitationReward !== undefined) {
    values.invitationReward = patch.invitationReward;
  }
  if (patch.invitationInviteeReward !== undefined) {
    values.invitationInviteeReward = patch.invitationInviteeReward;
  }
  const [row] = await db
    .update(siteSettings)
    .set(values)
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}

export async function setCheckinReward(value: unknown) {
  const reward = parseCheckinReward(value);
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({ checkinReward: reward, updatedAt: new Date() })
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
  const [row] = await db
    .update(siteSettings)
    .set({ donationImagePath: "", updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  await removeSiteAsset("donation", s.donationImagePath).catch((error) =>
    console.error("Failed to remove replaced donation image", error),
  );
  return mapSettings(row!);
}

export async function saveDonationImage(
  data: Buffer,
  mime: string,
): Promise<{ donationImagePath: string }> {
  await ensureRow();
  const prev = await getSiteSettings();
  const publicPath = await saveSiteAsset("donation", data, mime);
  try {
    await db
      .update(siteSettings)
      .set({ donationImagePath: publicPath, updatedAt: new Date() })
      .where(eq(siteSettings.id, 1));
  } catch (error) {
    await removeSiteAsset("donation", publicPath).catch(() => undefined);
    throw error;
  }
  await removeSiteAsset("donation", prev.donationImagePath).catch((error) =>
    console.error("Failed to remove replaced donation image", error),
  );

  return { donationImagePath: publicPath };
}
