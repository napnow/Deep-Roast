import { z } from "zod";

// Bounds protect storage and rendering; they do not constrain image generation.
export const MAX_CANVAS_LAYOUT_BYTES = 512 * 1024;
const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const imageNode = z.object({ id: z.string().uuid(), kind: z.literal("image").optional(), placeholder: z.boolean().optional(), x: coordinate, y: coordinate }).strict();
const textNode = z.object({
  id: z.string().uuid(),
  kind: z.literal("text"),
  x: coordinate,
  y: coordinate,
  text: z.string().max(12_000),
}).strict();
const node = z.discriminatedUnion("kind", [
  imageNode.extend({ kind: z.literal("image") }),
  textNode,
]).or(imageNode);
const connection = z.object({
  id: z.string().min(1).max(200),
  source: z.string().uuid(),
  target: z.string().uuid(),
}).strict();
const layout = z.object({
  nodes: z.array(node).max(500),
  connections: z.array(connection).max(1000).default([]),
  hiddenIds: z.array(z.string().uuid()).max(2000),
  viewport: z.object({ x: coordinate, y: coordinate, zoom: z.number().finite().min(0.2).max(2) }).strict(),
  revision: z.number().int().nonnegative().safe(),
}).strict().refine(value => {
  const ids = [...value.nodes.map(item => item.id), ...value.hiddenIds];
  const nodeIds = new Set(value.nodes.map(item => item.id));
  return new Set(ids).size === ids.length
    && value.connections.every(item => item.source !== item.target && nodeIds.has(item.source) && nodeIds.has(item.target));
}, "Duplicate IDs or invalid canvas connections").refine(
  value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_CANVAS_LAYOUT_BYTES,
  "Canvas layout is too large",
);

export type CanvasNodeLayout = z.infer<typeof node>;
export type CanvasConnection = z.infer<typeof connection>;
export type CanvasLayout = z.infer<typeof layout>;
export function parseCanvasLayout(value: unknown): CanvasLayout {
  return layout.parse(value);
}
