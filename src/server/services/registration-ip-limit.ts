export function shouldEnforceRegistrationIpLimit(
  ip: string,
  enabled: boolean,
  environment: string | undefined,
  bypassIps: readonly string[],
): boolean {
  if (!enabled || environment !== "production") return false;
  return !bypassIps.includes(ip);
}
