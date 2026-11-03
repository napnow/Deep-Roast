export function filterAdminUsers<T extends { username: string; status: string }>(
  users: T[], query: string, status: "all" | "active" | "banned",
): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  return users.filter((user) =>
    user.username.toLocaleLowerCase().includes(normalized) &&
    (status === "all" || user.status === status),
  );
}
