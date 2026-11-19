export type DeletableImage = {
  id: string;
  userId: string;
  versionGroupId: string | null;
};

export type ImageDeletionMode =
  | { mode: "selected"; userId: string }
  | { mode: "version-group"; userId: string; versionGroupId?: string };

export function planImageDeletions<T extends DeletableImage>(
  records: T[],
  ids: string[],
  options: ImageDeletionMode,
): T[] {
  if (options.mode === "version-group" && !options.versionGroupId?.trim()) {
    throw new Error("版本组不能为空");
  }
  const owned = records.filter((record) => record.userId === options.userId);
  const candidates = options.mode === "version-group"
    ? owned.filter((record) => record.versionGroupId === options.versionGroupId)
    : owned.filter((record) => ids.includes(record.id));
  const seen = new Set<string>();
  return candidates.filter((record) => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}
