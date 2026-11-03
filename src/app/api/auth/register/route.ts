import { db } from "@/db";
import {
  creditTransactions,
  registrationRecords,
  registrationRiskMarks,
  siteSettings,
  userInvitations,
  users,
} from "@/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { hashPassword, setAuthCookie, signToken } from "@/lib/auth";
import { normalizeInviteCode } from "@/lib/invitation";
import { ApiError, readJson } from "@/server/http";
import { enforceRateLimit, getClientIp } from "@/server/rate-limit";
import { assertPasswordStrength } from "@/server/services/auth-password";
import { createInviteCode } from "@/server/services/invitation-code";
import { lockRegistrationCleanup } from "@/server/services/registration-cleanup-lock";
import { isRegistrationIpLimitEnabled } from "@/server/services/registration-policy";
import {
  getInvitationReward,
  getInviteeInvitationReward,
} from "@/server/services/invitation-policy";
import {
  resolveRegistrationBenefits,
  resolveRestrictedInviterReward,
} from "@/server/services/registration-benefits";
import {
  getRegistrationRiskHashSecret,
  hashRegistrationIp,
  normalizeClientIp,
} from "@/server/services/registration-risk";

const REGISTER_IP_LIMIT = 10;
const REGISTER_WINDOW = 3600;
const INVITE_CODE_RETRIES = 3;
const POSTGRES_INTEGER_MAX = 2_147_483_647;

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
  benefitsRestricted: boolean;
};

async function registerInTransaction(args: {
  ip: string;
  username: string;
  hashedPassword: string;
  inviteCode: string | null;
}): Promise<RegistrationResult> {
  const { ip, username, hashedPassword, inviteCode } = args;

  return db.transaction(async (tx) => {
    await lockRegistrationCleanup(tx);
    const [settings] = await tx
      .select({
        registrationEnabled: siteSettings.registrationEnabled,
        invitationEnabled: siteSettings.invitationEnabled,
        invitationReward: siteSettings.invitationReward,
        invitationInviteeReward: siteSettings.invitationInviteeReward,
        registrationIpLimitEnabled: siteSettings.registrationIpLimitEnabled,
        signupBonusCredits: siteSettings.signupBonusCredits,
        checkinReward: siteSettings.checkinReward,
        repeatRegistrationLimitEnabled:
          siteSettings.repeatRegistrationLimitEnabled,
        repeatRegistrationSignupBonus:
          siteSettings.repeatRegistrationSignupBonus,
        repeatRegistrationCheckinReward:
          siteSettings.repeatRegistrationCheckinReward,
        repeatRegistrationInvitationReward:
          siteSettings.repeatRegistrationInvitationReward,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1);

    if ((settings?.registrationEnabled ?? 1) === 0) {
      throw new ApiError("暂不开放注册", 403);
    }

    const ipLimitActive = !shouldSkipIpLimit(
      ip,
      isRegistrationIpLimitEnabled(settings?.registrationIpLimitEnabled),
    );
    if (ipLimitActive) {
      await tx.insert(registrationRecords).values({ ip, username });
    }

    // 三天清理会为该 IP 留下风险标记；命中且未过期时降低新账号奖励
    const normalizedIp = normalizeClientIp(ip);
    const ipHash = normalizedIp
      ? hashRegistrationIp(normalizedIp, getRegistrationRiskHashSecret())
      : null;
    let riskRestrictedUntil: Date | null = null;
    if (ipHash) {
      const [mark] = await tx
        .select({ restrictedUntil: registrationRiskMarks.restrictedUntil })
        .from(registrationRiskMarks)
        .where(eq(registrationRiskMarks.ipHash, ipHash))
        .limit(1);
      riskRestrictedUntil = mark?.restrictedUntil ?? null;
    }

    const benefitSettings = {
      repeatRegistrationLimitEnabled:
        (settings?.repeatRegistrationLimitEnabled ?? 1) !== 0,
      repeatRegistrationSignupBonus:
        settings?.repeatRegistrationSignupBonus ?? 0,
      repeatRegistrationCheckinReward:
        settings?.repeatRegistrationCheckinReward ?? 10,
      repeatRegistrationInvitationReward:
        settings?.repeatRegistrationInvitationReward ?? 0,
      signupBonusCredits: settings?.signupBonusCredits ?? 50,
      checkinReward: settings?.checkinReward ?? 50,
    };
    const benefits = resolveRegistrationBenefits(
      benefitSettings,
      riskRestrictedUntil,
    );
    const signupBonusCredits = benefits.signupBonusCredits;

    const invitationEnabled = (settings?.invitationEnabled ?? 1) !== 0;
    let inviter: {
      id: string;
      username: string;
      role: string;
      status: string;
      restrictedUntil: Date | null;
    } | null = null;

    // 受限重注册不建立邀请关系，也不发放任何邀请奖励
    if (!benefits.restricted && inviteCode && invitationEnabled) {
      const [row] = await tx
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          status: users.status,
          restrictedUntil: users.restrictedUntil,
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
        credits: signupBonusCredits,
        inviteCode: createInviteCode(),
        lastLoginAt: new Date(),
        restrictedUntil: benefits.restrictedUntil,
        registrationIpHash: ipHash,
      })
      .returning({ id: users.id, username: users.username, role: users.role });

    if (!user) throw new Error("注册用户创建失败");

    await tx.insert(creditTransactions).values({
      userId: user.id,
      type: "signup_bonus",
      amount: signupBonusCredits,
      balanceAfter: signupBonusCredits,
      note: "新用户注册赠送",
    });

    if (inviter) {
      const inviterIsActiveUser =
        inviter.role === "user" && inviter.status === "active";
      // 受限账号作为邀请人时按受限邀请奖励发放（默认 0），
      // 被邀请人仍是正常新用户，保留其常规奖励。
      const restrictedInviterReward = inviterIsActiveUser
        ? resolveRestrictedInviterReward(
            benefitSettings,
            inviter.restrictedUntil,
          )
        : null;
      const reward =
        restrictedInviterReward ??
        getInvitationReward(
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
        if (signupBonusCredits > POSTGRES_INTEGER_MAX - inviteeReward) {
          throw new ApiError(
            "注册赠送积分与邀请奖励之和超过积分上限，请先调整配置",
            400,
            "CREDIT_LIMIT_EXCEEDED",
          );
        }

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

    return { ...user, benefitsRestricted: benefits.restricted };
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

    const body = await readJson<{
      username?: unknown;
      password?: unknown;
      inviteCode?: unknown;
    }>(req);
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
    }, hashedPassword);
    await setAuthCookie(token);

    return Response.json(
      {
        success: true,
        username: user.username,
        role: user.role,
        benefitsRestricted: user.benefitsRestricted,
      },
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
