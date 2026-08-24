export function isRegistrationIpLimitEnabled(value?: string): boolean {
  return value?.trim().toLowerCase() !== "false";
}
