import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { styles } from "@/db/schema";
import { ApiError } from "@/server/http";

const MAX_LABEL = 30;
const MAX_PREFIX = 8000;
const MAX_ITEMS = 12;
const MAX_ITEM_LEN = 100;

export interface StyleInput {
  styleKey?: string;
  label?: string;
  prefix?: string;
  colors?: string[];
  textures?: string[];
  published?: boolean;
}

export interface StyleOut {
  id: string;
  styleKey: string;
  label: string;
  prefix: string;
  colors: string[];
  textures: string[];
  published: boolean;
  createdAt: string;
}

function parseJsonArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function toStyleOut(row: typeof styles.$inferSelect): StyleOut {
  return {
    id: row.id,
    styleKey: row.styleKey,
    label: row.label,
    prefix: row.prefix,
    colors: parseJsonArray(row.colors),
    textures: parseJsonArray(row.textures),
    published: row.published === 1,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
  };
}

function validateItems(items: unknown, name: string): string[] {
  if (items === undefined) return [];
  if (!Array.isArray(items)) throw new ApiError(`${name} 必须是数组`, 400);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") {
      throw new ApiError(`${name} 必须是字符串数组`, 400);
    }
    const v = item.trim();
    if (!v) continue;
    if (v.length > MAX_ITEM_LEN) {
      throw new ApiError(`${name} 单项不能超过 ${MAX_ITEM_LEN} 字符`, 400);
    }
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  if (out.length > MAX_ITEMS) {
    throw new ApiError(`${name} 最多 ${MAX_ITEMS} 项`, 400);
  }
  return out;
}

function validateInput(input: StyleInput, partial = false) {
  const out: Partial<StyleOut> = {};
  if (input.styleKey !== undefined || !partial) {
    const key = (input.styleKey ?? "").trim();
    if (!key) throw new ApiError("风格标识不能为空", 400);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) {
      throw new ApiError("风格标识只能用小写字母、数字和连字符", 400);
    }
    out.styleKey = key;
  }
  if (input.label !== undefined || !partial) {
    const label = (input.label ?? "").trim();
    if (!label) throw new ApiError("风格名称不能为空", 400);
    if (label.length > MAX_LABEL) {
      throw new ApiError(`风格名称不能超过 ${MAX_LABEL} 字`, 400);
    }
    out.label = label;
  }
  if (input.prefix !== undefined || !partial) {
    const prefix = (input.prefix ?? "").trim();
    if (!prefix) throw new ApiError("风格规则不能为空", 400);
    if (prefix.length > MAX_PREFIX) {
      throw new ApiError(`风格规则不能超过 ${MAX_PREFIX} 字符`, 400);
    }
    out.prefix = prefix;
  }
  if (input.colors !== undefined || !partial) {
    out.colors = validateItems(input.colors, "颜色");
  }
  if (input.textures !== undefined || !partial) {
    out.textures = validateItems(input.textures, "纹理");
  }
  if (input.published !== undefined || !partial) {
    out.published = Boolean(input.published);
  }
  return out;
}

/** 管理端：全部风格（含未发布） */
export async function listAllStyles(): Promise<StyleOut[]> {
  const rows = await db.select().from(styles).orderBy(asc(styles.styleKey));
  return rows.map(toStyleOut);
}

/** 用户端：仅公开（published=1）的风格 */
export async function listPublishedStyles(): Promise<StyleOut[]> {
  const rows = await db
    .select()
    .from(styles)
    .where(eq(styles.published, 1))
    .orderBy(asc(styles.styleKey));
  return rows.map(toStyleOut);
}

export async function createStyle(input: StyleInput): Promise<StyleOut> {
  const v = validateInput(input, false);
  const [row] = await db
    .insert(styles)
    .values({
      styleKey: v.styleKey!,
      label: v.label!,
      prefix: v.prefix!,
      colors: JSON.stringify(v.colors ?? []),
      textures: JSON.stringify(v.textures ?? []),
      published: v.published ? 1 : 0,
    })
    .returning();
  return toStyleOut(row!);
}

export async function updateStyle(
  id: string,
  input: StyleInput,
): Promise<StyleOut> {
  const v = validateInput(input, true);
  const patch: Partial<typeof styles.$inferInsert> = {};
  if (v.styleKey !== undefined) patch.styleKey = v.styleKey;
  if (v.label !== undefined) patch.label = v.label;
  if (v.prefix !== undefined) patch.prefix = v.prefix;
  if (v.colors !== undefined) patch.colors = JSON.stringify(v.colors);
  if (v.textures !== undefined) patch.textures = JSON.stringify(v.textures);
  if (v.published !== undefined) patch.published = v.published ? 1 : 0;
  if (Object.keys(patch).length > 0) patch.updatedAt = new Date();

  const [row] = await db
    .update(styles)
    .set(patch)
    .where(eq(styles.id, id))
    .returning();
  if (!row) throw new ApiError("风格不存在", 404);
  return toStyleOut(row);
}

export async function deleteStyle(id: string): Promise<{ success: true }> {
  const [row] = await db
    .delete(styles)
    .where(eq(styles.id, id))
    .returning({ id: styles.id });
  if (!row) throw new ApiError("风格不存在", 404);
  return { success: true };
}
