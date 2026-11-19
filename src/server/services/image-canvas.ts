import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { imageCanvasLayouts, imageGenerations } from "@/db/schema";
import { parseCanvasLayout, type CanvasLayout } from "@/lib/canvas-layout";
import { ApiError } from "@/server/http";
import { listImageHistory, listOwnedImagesById } from "./image";

export class MissingCanvasImagesError extends ApiError {
  constructor(readonly missingIds: string[]) {
    super("画布包含不可用的作品", 400, "INVALID_CANVAS_IMAGE");
  }
}

export async function loadCanvas(userId: string) {
  const [row] = await db.select().from(imageCanvasLayouts).where(eq(imageCanvasLayouts.userId, userId)).limit(1);
  const layout = row ? parseCanvasLayout({ nodes: row.nodes, connections: row.connections, hiddenIds: row.hiddenIds, viewport: row.viewport, revision: row.revision }) : null;
  const savedIds = layout ? [
    ...layout.nodes.filter(node => node.kind !== "text" && !node.placeholder).map(node => node.id),
    ...layout.hiddenIds,
  ] : [];
  const [recent, saved] = await Promise.all([listImageHistory(userId), listOwnedImagesById(userId, savedIds)]);
  const savedSet = new Set(saved.map(item => item.id));
  // Records deleted since the previous save are not allowed back into a write.
  const cleanedNodes = layout?.nodes.filter(node => node.kind === "text" || node.placeholder || savedSet.has(node.id)) ?? [];
  const cleanedNodeIds = new Set(cleanedNodes.map(node => node.id));
  const cleaned = layout ? {
    ...layout,
    nodes: cleanedNodes,
    connections: layout.connections.filter(connection => cleanedNodeIds.has(connection.source) && cleanedNodeIds.has(connection.target)),
    hiddenIds: layout.hiddenIds.filter(id => savedSet.has(id)),
  } : null;
  const images = [...new Map([...saved, ...recent].map(image => [image.id, image])).values()];
  return { layout: cleaned, images };
}

export async function saveCanvas(userId: string, input: unknown) {
  let layout: CanvasLayout;
  try { layout = parseCanvasLayout(input); }
  catch { throw new ApiError("画布数据无效或数量超限", 400, "INVALID_CANVAS_LAYOUT"); }
  const imageIds = [
    ...layout.nodes.filter(node => node.kind !== "text" && !node.placeholder).map(node => node.id),
    ...layout.hiddenIds,
  ];
  if (imageIds.length) {
    const owned = await db.select({ id: imageGenerations.id }).from(imageGenerations).where(and(eq(imageGenerations.userId, userId), inArray(imageGenerations.id, imageIds)));
    if (owned.length !== imageIds.length) {
      const available = new Set(owned.map(image => image.id));
      throw new MissingCanvasImagesError(imageIds.filter(id => !available.has(id)));
    }
  }
  const values = {
    nodes: layout.nodes,
    connections: layout.connections,
    hiddenIds: layout.hiddenIds,
    viewport: layout.viewport,
    updatedAt: new Date(),
  };
  const [saved] = layout.revision === 0
    ? await db.insert(imageCanvasLayouts).values({ userId, revision: 1, ...values }).onConflictDoNothing().returning({ revision: imageCanvasLayouts.revision })
    : await db.update(imageCanvasLayouts).set({ ...values, revision: sql`${imageCanvasLayouts.revision} + 1` }).where(and(eq(imageCanvasLayouts.userId, userId), eq(imageCanvasLayouts.revision, layout.revision))).returning({ revision: imageCanvasLayouts.revision });
  if (!saved) throw new ApiError("其他设备已更新画布，请先处理冲突", 409, "CANVAS_CONFLICT");
  return { revision: saved.revision };
}
