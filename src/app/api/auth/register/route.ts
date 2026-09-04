import { db } from "@/db";
import {
  creditTransactions,
  registrationRecords,
  siteSettings,
  userInvitations,
  users,
} from "@/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { normalizeInviteCode } from "@/lib/invitation";
import { ApiError } from "@/server/http";
import { enforceRateLimit, getClientIp } from "@/server/rate-limit";
import { assertPasswordStrength } from "@/server/services/auth-password";
import { createInviteCode } from "@/server/services/invitation-code";
import { isRegistrationIpLimitEnabled } from "@/server/services/registration-policy";
import {
  getInvitationReward,
  getInviteeInvitationReward,
} from "@/server/services/invitation-policy";

const REGISTER_IP_LIMIT = 10;
const REGISTER_WINDOW = 3600;
const INVITE_CODE_RETRIES = 3;

/** 生产环境白名单 IP（逗号分隔），这些 IP 不受单 IP 注册限制 */
const BYPASS_IPS = (process.env.REGISTRATION_BYPASS_IPS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function shouldSkipIpLimit(ip: string, enabled: boolean): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (!enabled) return true;
  return BYPASS_IPS.includes(ip);
}

function errorText(err: unknown): string {
  const e = err as {
    message?: string;
    constraint?: string;
    detail?: string;
  };
  return [e?.message, e?.constraint, e?.detail].filter(Boolean).join(" ");
}

function isUniqueViolation(err: unknown, names: string[]): boolean {
  const e = err as { code?: string };
  if (e?.code !== "23505") return false;
  const text = errorText(err);
  return names.some((name) => text.includes(name));
}

function isIpUniqueViolation(err: unknown): boolean {
  return isUniqueViolation(err, [
    "registration_records_ip_unique",
    "registration_records.ip",
  ]);
}

function isUsernameUniqueViolation(err: unknown): boolean {
  return isUniqueViolation(err, ["users_username_unique", "users.username"]);
}

function isInviteCodeUniqueViolation(err: unknown): boolean {
  return isUniqueViolation(err, ["users_invite_code_unique", "users.invite_code"]);
}

type RegistrationResult = {
  id: string;
  username: string;
  role: string;
};

async function registerInTransaction(args: {
  ip: string;
  username: string;
  hashedPassword: string;
  inviteCode: string | null;
  ipLimitActive: boolean;
}): Promise<RegistrationResult> {
  const { ip, username, hashedPassword, inviteCode, ipLimitActive } = args;

  return db.transaction(async (tx) => {
    const [settings] = await tx
      .select({
        registrationEnabled: siteSettings.registrationEnabled,
        invitationEnabled: siteSettings.invitationEnabled,
        invitationReward: siteSettings.invitationReward,
        invitationInviteeReward: siteSettings.invitationInviteeReward,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);

    if ((settings?.registrationEnabled ?? 1) === 0) {
      throw new ApiError("暂不开放注册", 403);
    }

    if (ipLimitActive) {
      await tx.insert(registrationRecords).values({ ip, username });
    }

    const invitationEnabled = (settings?.invitationEnabled ?? 1) !== 0;
    let inviter: {
      id: string;
      username: string;
      role: string;
      status: string;
    } | null = null;

    if (inviteCode && invitationEnabled) {
      const [row] = await tx
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          status: users.status,
        })
        .from(users)
        .where(
          or(
            eq(users.inviteCode, inviteCode),
            eq(users.legacyInviteCode, inviteCode),
          ),
        )
        .limit(1);

      if (!row || row.role !== "user" || row.status !== "active") {
        throw new ApiError(
          "邀请链接无效或已失效",
          400,
          "INVALID_INVITE_CODE",
        );
      }
      inviter = row;
    }

    const [user] = await tx
      .insert(users)
      .values({
        username,
        password: hashedPassword,
        credits: 50,
        inviteCode: createInviteCode(),
      })
      .returning({ id: users.id, username: users.username, role: users.role });

    if (!user) throw new Error("注册用户创建失败");

    await tx.insert(creditTransactions).values({
      userId: user.id,
      type: "signup_bonus",
      amount: 50,
      balanceAfter: 50,
      note: "新用户注册赠送",
    });

    if (inviter) {
      const inviterIsActiveUser =
        inviter.role === "user" && inviter.status === "active";
      const reward = getInvitationReward(
        invitationEnabled,
        settings?.invitationReward ?? 200,
        inviterIsActiveUser,
        inviteCode,
      );
      const inviteeReward = getInviteeInvitationReward(
        invitationEnabled,
        settings?.invitationInviteeReward ?? 50,
        inviterIsActiveUser,
        inviteCode,
      );

      if (reward !== null && inviteeReward !== null) {
        const [updatedInviter] = await tx
          .update(users)
          .set({
            credits: sql`${users.credits} + ${reward}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(users.id, inviter.id),
              eq(users.role, "user"),
              eq(users.status, "active"),
            ),
          )
          .returning({ credits: users.credits });

        if (!updatedInviter) {
          throw new ApiError(
            "邀请链接无效或已失效",
            400,
            "INVALID_INVITE_CODE",
          );
        }

        if (inviteeReward > 0) {
          const [updatedInvitee] = await tx
            .update(users)
            .set({
              credits: sql`${users.credits} + ${inviteeReward}`,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id))
            .returning({ credits: users.credits });

          if (!updatedInvitee) {
            throw new Error("被邀请人奖励发放失败");
          }

          await tx.insert(creditTransactions).values({
            userId: user.id,
            type: "invitee_reward",
            amount: inviteeReward,
            balanceAfter: updatedInvitee.credits,
            note: "受邀注册额外奖励",
          });
        }

        await tx.insert(userInvitations).values({
          inviterId: inviter.id,
          inviteeId: user.id,
          inviterUsername: inviter.username,
          inviteeUsername: user.username,
          rewardAmount: reward,
          inviteeRewardAmount: inviteeReward,
        });

        if (reward > 0) {
          await tx.insert(creditTransactions).values({
            userId: inviter.id,
            type: "invite_reward",
            amount: reward,
            balanceAfter: updatedInviter.credits,
            note: `邀请 ${user.username} 注册奖励`,
          });
        }
      }
    }

    return user;
  });
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    await enforceRateLimit(
      "register-ip",
      ip,
      REGISTER_IP_LIMIT,
      REGISTER_WINDOW,
    );

    const body = (await req.json()) as {
      username?: unknown;
      password?: unknown;
      inviteCode?: unknown;
    };
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return Response.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    if (username.length < 2 || username.length > 32) {
      return Response.json({ error: "用户名需要 2-32 个字符" }, { status: 400 });
    }

    try {
      assertPasswordStrength(password);
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (existing.length > 0) {
      return Response.json({ error: "用户名已存在" }, { status: 409 });
    }

    const [registrationSettings] = await db
      .select({
        registrationIpLimitEnabled: siteSettings.registrationIpLimitEnabled,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);
    const ipLimitActive = !shouldSkipIpLimit(
      ip,
      isRegistrationIpLimitEnabled(
        registrationSettings?.registrationIpLimitEnabled,
      ),
    );
    if (ipLimitActive) {
      const [ipRecord] = await db
        .select({ id: registrationRecords.id })
        .from(registrationRecords)
        .where(eq(registrationRecords.ip, ip))
        .limit(1);
      if (ipRecord) {
        return Response.json(
          { error: "该网络地址已注册过账号，如有疑问请联系管理员" },
          { status: 403 },
        );
      }
    }

    const hashedPassword = await hashPassword(password);
    const inviteCode = normalizeInviteCode(body.inviteCode);
    let user: RegistrationResult | null = null;

    for (let attempt = 0; attempt < INVITE_CODE_RETRIES; attempt += 1) {
      try {
        user = await registerInTransaction({
          ip,
          username,
          hashedPassword,
          inviteCode,
          ipLimitActive,
        });
        break;
      } catch (err) {
        if (isInviteCodeUniqueViolation(err) && attempt < INVITE_CODE_RETRIES - 1) {
          continue;
        }
        if (isIpUniqueViolation(err)) {
          return Response.json(
            { error: "该网络地址已注册过账号，如有疑问请联系管理员" },
            { status: 403 },
          );
        }
        if (isUsernameUniqueViolation(err)) {
          return Response.json({ error: "用户名已存在" }, { status: 409 });
        }
        throw err;
      }
    }

    if (!user) throw new Error("注册用户创建失败");

    const token = await signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });
    await setAuthCookie(token);

    return Response.json(
      { success: true, username: user.username, role: user.role },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: err.headers },
      );
    }
    console.error("[register] 未预期错误:", err);
    return Response.json({ error: "注册失败，请重试" }, { status: 500 });
  }
}
