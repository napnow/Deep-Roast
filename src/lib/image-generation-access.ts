export function canUseImageGeneration(
  role: string,
  enabled: boolean,
): boolean {
  return role === "admin" || enabled;
}
