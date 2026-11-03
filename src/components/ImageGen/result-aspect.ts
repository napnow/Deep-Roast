export function resultAspectRatio(size: string): number | null {
  const match = /^(\d+)x(\d+)$/i.exec(size.trim());
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : null;
}
