import { ApiError } from "@/server/http";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

export interface CheckinSettingsPatch {
  checkinReward?: number;
}

export function parseCheckinReward(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0 ||
    parsed > POSTGRES_INTEGER_MAX
  ) {
    throw new ApiError("签到奖励必须是非负整数", 400);
  }

  return parsed;
}

export function parseCheckinSettingsPatch(body: {
  checkinReward?: unknown;
}): CheckinSettingsPatch {
  if (body.checkinReward === undefined) return {};
  return { checkinReward: parseCheckinReward(body.checkinReward) };
}
