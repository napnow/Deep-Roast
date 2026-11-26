import { promises as fs } from "node:fs";
import path from "node:path";
import bundled from "@/data/wear-library.json";
import { normalizeWearLibrary, type WearLibraryItem } from "@/components/ImageGen/wear-library";

/**
 * 素材来源：
 * 1. 打包内置的 src/data/wear-library.json（精选时尚穿搭、姿态与光影预设）
 * 2. 可选：本地目录 $DEEPROAST_DATA_DIR/wear-library/*.json（不进 Git，适合私有扩展素材包）
 */
const TTL_MS = 60 * 1000;
const normalizedBundled = normalizeWearLibrary(bundled as unknown[]);
let cache: { items: WearLibraryItem[]; expires: number } | null = null;

async function readLocalPacks(): Promise<unknown[]> {
  const root = process.env.DEEPROAST_DATA_DIR;
  if (!root) return [];
  const dir = path.join(root, "wear-library");
  try {
    const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".json"));
    const packs = await Promise.all(
      files.map(async (name) => {
        try {
          const value: unknown = JSON.parse(await fs.readFile(path.join(dir, name), "utf8"));
          return Array.isArray(value) ? value : [];
        } catch {
          return [];
        }
      }),
    );
    return packs.flat();
  } catch {
    return [];
  }
}

export async function getWearLibraryItems(): Promise<WearLibraryItem[]> {
  if (!process.env.DEEPROAST_DATA_DIR) return normalizedBundled;
  if (cache && cache.expires > Date.now()) return cache.items;
  const local = await readLocalPacks();
  const items = local.length ? normalizeWearLibrary([...local, ...normalizedBundled]) : normalizedBundled;
  cache = { items, expires: Date.now() + TTL_MS };
  return items;
}
