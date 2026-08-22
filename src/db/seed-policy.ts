export function requireAdminSeedPassword(value: string | undefined): string {
  const password = value?.trim();
  if (!password) {
    throw new Error("ADMIN_PASSWORD must be set before creating the admin user");
  }
  return password;
}
