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

export function getImageRatio(size: string): number {
  const match = size.trim().match(/(\d+(?:\.\d+)?)\s*[x×:]\s*(\d+(?:\.\d+)?)/i);
  if (!match) return 1;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? width / height : 1;
}

export function getCanvasNodeSize(size: string): { width: number; height: number } {
  const ratio = getImageRatio(size);
  const minWidth = 220;
  const maxWidth = 620;
  const minHeight = 180;
  const maxHeight = 560;
  let width = 320;
  let height = 320;
  if (ratio >= 1) {
    height = Math.max(minHeight, Math.min(maxHeight, 300 / Math.sqrt(ratio)));
    width = height * ratio;
    if (width > maxWidth) {
      width = maxWidth;
      height = Math.max(minHeight, width / ratio);
    }
  } else {
    width = Math.max(minWidth, Math.min(maxWidth, 320 * Math.sqrt(ratio)));
    height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = Math.max(minWidth, height * ratio);
    }
  }
  return { width: Math.round(width), height: Math.round(height) };
}
