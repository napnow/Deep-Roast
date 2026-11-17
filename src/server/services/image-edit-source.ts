import { ApiError } from "@/server/http";
import { protectedImageUrl, protectedLegacyImageUrl } from "./private-images";

interface SourceRecord {
  id: string;
  userId: string;
  imageUrl: string;
  storageKey: string | null;
  versionGroupId: string | null;
}
type Lookup = (userId: string, id: string) => Promise<SourceRecord | undefined>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Treat request metadata as untrusted: bind it to the owner and the target bytes. */
export async function resolveImageEditSource(userId: string, id: string | undefined, target: string, lookup: Lookup) {
  if (!id) return null;
  if (!uuid.test(id)) throw new ApiError("来源作品标识无效", 400, "INVALID_IMAGE_SOURCE");
  const record = await lookup(userId, id);
  if (!record || record.userId !== userId) throw new ApiError("来源作品不可用", 404, "IMAGE_SOURCE_NOT_FOUND");
  const legacy = /^\/images\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp))$/i.exec(record.imageUrl);
  const canonical = record.storageKey ? protectedImageUrl(record.storageKey) : legacy ? protectedLegacyImageUrl(legacy[1]!) : record.imageUrl;
  if (target.trim() !== canonical && target.trim() !== record.imageUrl) {
    throw new ApiError("目标图片与来源作品不一致", 400, "IMAGE_SOURCE_MISMATCH");
  }
  // Legacy files are read through the existing owner-checked /images/ path.
  return { sourceImageId: record.id, versionGroupId: record.versionGroupId || record.id, image: legacy && !record.storageKey ? record.imageUrl : canonical };
}


type ResolvedSource = { sourceImageId: string; versionGroupId: string; image: string };

/** Read each authorized parent before dispatch, under its task's reference-size limit. */
export async function snapshotImageEditSources(
  sources: (ResolvedSource | null)[],
  normalize: (values: string[]) => Promise<string[]>,
): Promise<(ResolvedSource | null)[]> {
  const present = sources.filter((source): source is ResolvedSource => source !== null);
  if (!present.length) return sources;
  const snapshots: string[] = [];
  // Independent edit tasks must not share a cumulative reference allowance.
  // Sequential reads also keep peak memory bounded on the small production host.
  for (const source of present) {
    const normalized = await normalize([source.image]);
    if (normalized.length !== 1) throw new Error("Invalid image snapshot count");
    snapshots.push(normalized[0]!);
  }
  let index = 0;
  return sources.map(source => source ? { ...source, image: snapshots[index++]! } : null);
}
