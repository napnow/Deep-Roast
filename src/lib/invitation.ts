export function normalizeInviteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return code ? code : null;
}

export function buildInviteLink(origin: string, inviteCode: string): string {
  const url = new URL("/login", origin);
  url.searchParams.set("invite", inviteCode);
  return url.toString();
}
