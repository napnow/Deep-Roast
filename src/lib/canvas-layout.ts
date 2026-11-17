import { z } from "zod";

// Bounds protect storage and rendering; they do not constrain image generation.
const coordinate = z.number().finite().min(-1_000_000).max(1_000_000);
const node = z.object({ id: z.string().uuid(), x: coordinate, y: coordinate }).strict();
const layout = z.object({
  nodes: z.array(node).max(500),
  hiddenIds: z.array(z.string().uuid()).max(2000),
  viewport: z.object({ x: coordinate, y: coordinate, zoom: z.number().finite().min(0.2).max(2) }).strict(),
  revision: z.number().int().nonnegative().safe(),
}).strict().refine(value => {
  const ids = [...value.nodes.map(item => item.id), ...value.hiddenIds];
  return new Set(ids).size === ids.length;
}, "Duplicate or too many image IDs");

export type CanvasLayout = z.infer<typeof layout>;
export function parseCanvasLayout(value: unknown): CanvasLayout {
  return layout.parse(value);
}
