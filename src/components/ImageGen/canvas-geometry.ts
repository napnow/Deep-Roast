export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasViewport extends CanvasPoint {
  zoom: number;
}

export function screenToCanvas(point: CanvasPoint, viewport: CanvasViewport): CanvasPoint {
  return { x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom };
}

export function zoomAtPoint(viewport: CanvasViewport, point: CanvasPoint, requestedZoom: number): CanvasViewport {
  const zoom = Math.max(0.25, Math.min(3, requestedZoom));
  const anchor = screenToCanvas(point, viewport);
  return { x: point.x - anchor.x * zoom, y: point.y - anchor.y * zoom, zoom };
}
