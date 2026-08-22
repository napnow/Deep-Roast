import { db } from "@/db";
import { siteSettings, userInvitations, users } from "@/db/schema";
import { ApiError } from "@/server/http";
import { buildInviteLink } from "@/lib/invitation";
import { desc, eq, inArray, sql } from "drizzle-orm";

const MAX_INVITATION_ROWS = 500;
const MAX_INVITATION_PAGE_SIZE = 100;

export function normalizeInvitationListQuery(
  rawLimit: string | null | undefined,
  rawOffset: string | null | undefined,
) {
  const parsedLimit = Number(rawLimit ?? 100);
  const parsedOffset = Number(rawOffset ?? 0);
  return {
    limit: Math.min(
      Math.max(Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 100, 1),
      MAX_INVITATION_PAGE_SIZE,
    ),
    offset: Math.max(
      Number.isFinite(parsedOffset) ? Math.trunc(parsedOffset) : 0,
      0,
    ),
  };
}

export function parseInvitationReward(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > 2_147_483_647
  ) {
    throw new ApiError("奖励积分必须是非负整数", 400);
  }
  return parsed;
}

function getPublicOrigin(req: Request): string {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Invalid optional configuration falls back to the current request host.
    }
  }
  return new URL(req.url).origin;
}

export async function getUserInvitationData(
  userId: string,
  role: string,
  req: Request,
) {
  const [user] = await db
    .select({
      inviteCode: users.inviteCode,
      legacyInviteCode: users.legacyInviteCode,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new ApiError("用户不存在", 404);

  const [settings, rows] = await Promise.all([
    db
      .select({
        invitationEnabled: siteSettings.invitationEnabled,
        invitationReward: siteSettings.invitationReward,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1),
    role === "user"
      ? db
          .select({
            inviteeUsername: userInvitations.inviteeUsername,
            rewardAmount: userInvitations.rewardAmount,
            createdAt: userInvitations.createdAt,
          })
          .from(userInvitations)
          .where(eq(userInvitations.inviterId, userId))
          .orderBy(desc(userInvitations.createdAt))
          .limit(MAX_INVITATION_ROWS)
      : Promise.resolve([]),
  ]);

  const eligible = role === "user";
  const enabled = (settings[0]?.invitationEnabled ?? 1) !== 0;
  const inviteCode = user.inviteCode ?? user.legacyInviteCode;
  const invitations = rows.map((row) => ({
    inviteeUsername: row.inviteeUsername,
    rewardAmount: row.rewardAmount,
    createdAt: row.createdAt,
  }));

  return {
    eligible,
    enabled,
    reward: settings[0]?.invitationReward ?? 200,
    inviteCode: eligible ? inviteCode : null,
    inviteLink:
      eligible && inviteCode
        ? buildInviteLink(getPublicOrigin(req), inviteCode)
        : null,
    invitedCount: invitations.length,
    totalReward: invitations.reduce((sum, row) => sum + row.rewardAmount, 0),
    invitations,
  };
}

export async function listAdminInvitations(limit = 100, offset = 0) {
  const safeQuery = normalizeInvitationListQuery(String(limit), String(offset));
  const [rows, statsRows] = await Promise.all([
    db
      .select({
        id: userInvitations.id,
        inviterId: userInvitations.inviterId,
        inviteeId: userInvitations.inviteeId,
        inviterUsername: userInvitations.inviterUsername,
        inviteeUsername: userInvitations.inviteeUsername,
        rewardAmount: userInvitations.rewardAmount,
        createdAt: userInvitations.createdAt,
      })
      .from(userInvitations)
      .orderBy(desc(userInvitations.createdAt))
      .limit(safeQuery.limit)
      .offset(safeQuery.offset),
    db
      .select({
        totalInvitations: sql<number>`count(*)::int`,
        totalReward: sql<number>`coalesce(sum(${userInvitations.rewardAmount}), 0)::int`,
      })
      .from(userInvitations),
  ]);

  const ids = [
    ...new Set(
      rows
        .flatMap((row) => [row.inviterId, row.inviteeId])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const currentUsers = ids.length
    ? await db
        .select({ id: users.id, status: users.status, role: users.role })
        .from(users)
        .where(inArray(users.id, ids))
    : [];
  const currentById = new Map(currentUsers.map((row) => [row.id, row]));

  const totalInvitations = Number(statsRows[0]?.totalInvitations ?? 0);
  return {
    stats: {
      totalInvitations,
      totalReward: Number(statsRows[0]?.totalReward ?? 0),
    },
    pagination: {
      limit: safeQuery.limit,
      offset: safeQuery.offset,
      hasMore: safeQuery.offset + rows.length < totalInvitations,
      nextOffset:
        safeQuery.offset + rows.length < totalInvitations
          ? safeQuery.offset + rows.length
          : null,
    },
    invitations: rows.map((row) => ({
      id: row.id,
      inviterUsername: row.inviterUsername,
      inviteeUsername: row.inviteeUsername,
      rewardAmount: row.rewardAmount,
      createdAt: row.createdAt,
      inviterStatus: row.inviterId
        ? currentById.get(row.inviterId)?.status ?? "deleted"
        : "deleted",
      inviteeStatus: row.inviteeId
        ? currentById.get(row.inviteeId)?.status ?? "deleted"
        : "deleted",
      inviterRole: row.inviterId
        ? currentById.get(row.inviterId)?.role ?? null
        : null,
    })),
  };
}
