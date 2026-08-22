import type { ImageRecord } from "@/types";

export type ImageSourceMode = "text" | "edit" | "unknown";
export type ImageFilterMode = "all" | "text" | "edit";
export type LibraryImage = ImageRecord & { sourceMode: ImageSourceMode };
export interface ImageHistoryGroup {
  label: "今天" | "昨天" | "更早";
  images: LibraryImage[];
}

export function mergeImageSourceModes(
  images: ImageRecord[],
  sourceMap: Record<string, ImageSourceMode>,
): LibraryImage[] {
  return images.map((image) => ({
    ...image,
    sourceMode: image.sourceMode || sourceMap[image.id] || "unknown",
  }));
}

export function filterImages(
  images: LibraryImage[],
  query: string,
  mode: ImageFilterMode,
): LibraryImage[] {
  const needle = query.trim().toLowerCase();
  return images.filter(
    (image) =>
      (!needle || image.prompt.toLowerCase().includes(needle)) &&
      (mode === "all" || image.sourceMode === mode),
  );
}

export function reuseParametersFromImage(image: ImageRecord) {
  return { prompt: image.prompt, size: image.size, model: image.model };
}

export function confirmedImageDeletionId(
  imageId: string,
  confirmed: boolean,
): string | null {
  return confirmed ? imageId : null;
}

export function groupImagesByDate(
  images: ImageRecord[],
  now = new Date(),
): ImageHistoryGroup[] {
  const dayKey = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const buckets: Record<ImageHistoryGroup["label"], LibraryImage[]> = {
    今天: [],
    昨天: [],
    更早: [],
  };
  for (const source of images) {
    const image: LibraryImage = {
      ...source,
      sourceMode: source.sourceMode || "unknown",
    };
    const created = new Date(image.createdAt);
    const label =
      dayKey(created) === dayKey(now)
        ? "今天"
        : dayKey(created) === dayKey(yesterday)
          ? "昨天"
          : "更早";
    buckets[label].push(image);
  }
  return (["今天", "昨天", "更早"] as const)
    .filter((label) => buckets[label].length > 0)
    .map((label) => ({ label, images: buckets[label] }));
}
