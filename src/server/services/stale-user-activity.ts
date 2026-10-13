export const STALE_USER_WINDOW_MS = 72 * 60 * 60 * 1000;

export interface ActivityTimestamps {
  createdAt: Date | string | null | undefined;
  lastLoginAt: Date | string | null | undefined;
  latestConversationAt: Date | string | null | undefined;
  latestImageAt: Date | string | null | undefined;
  lastCheckinOn?: Date | string | null | undefined;
  latestCheckinAt?: Date | string | null | undefined;
  latestConsumeAt?: Date | string | null | undefined;
  latestApiUseAt?: Date | string | null | undefined;
}

function timestamp(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

function shanghaiCalendarDayEndTimestamp(
  value: Date | string | null | undefined,
): number {
  if (typeof value !== "string") return 0;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const result = Date.UTC(year, month - 1, day, 15, 59, 59, 999);
  const local = new Date(result + 8 * 60 * 60 * 1000);
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day
  ) {
    return 0;
  }
  return result;
}

function shanghaiCalendarDayAtTimestamp(value: number): string {
  const local = new Date(value + 8 * 60 * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLastActivityAt(input: ActivityTimestamps): Date {
  const exactCheckinAt = timestamp(input.latestCheckinAt);
  const legacyCheckinDayEnd = shanghaiCalendarDayEndTimestamp(
    input.lastCheckinOn,
  );
  const checkinAt =
    exactCheckinAt &&
    input.lastCheckinOn === shanghaiCalendarDayAtTimestamp(exactCheckinAt)
      ? exactCheckinAt
      : Math.max(exactCheckinAt, legacyCheckinDayEnd);
  return new Date(
    Math.max(
      timestamp(input.createdAt),
      timestamp(input.lastLoginAt),
      timestamp(input.latestConversationAt),
      timestamp(input.latestImageAt),
      checkinAt,
      timestamp(input.latestConsumeAt),
      timestamp(input.latestApiUseAt),
    ),
  );
}

export function getStaleUserCutoff(now = new Date()): Date {
  return new Date(now.getTime() - STALE_USER_WINDOW_MS);
}

export function isStaleUser(input: ActivityTimestamps, cutoff: Date): boolean {
  return getLastActivityAt(input).getTime() < cutoff.getTime();
}
