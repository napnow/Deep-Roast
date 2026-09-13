export const STALE_USER_WINDOW_MS = 72 * 60 * 60 * 1000;

export interface ActivityTimestamps {
  createdAt: Date | string | null | undefined;
  lastLoginAt: Date | string | null | undefined;
  latestConversationAt: Date | string | null | undefined;
  latestImageAt: Date | string | null | undefined;
}

function timestamp(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

export function getLastActivityAt(input: ActivityTimestamps): Date {
  return new Date(
    Math.max(
      timestamp(input.createdAt),
      timestamp(input.lastLoginAt),
      timestamp(input.latestConversationAt),
      timestamp(input.latestImageAt),
    ),
  );
}

export function getStaleUserCutoff(now = new Date()): Date {
  return new Date(now.getTime() - STALE_USER_WINDOW_MS);
}

export function isStaleUser(input: ActivityTimestamps, cutoff: Date): boolean {
  return getLastActivityAt(input).getTime() < cutoff.getTime();
}
