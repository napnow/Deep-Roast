/** Space below the visual viewport that remains inside the layout viewport. */
export function getViewportOcclusion(layoutHeight: number, visibleHeight: number, offsetTop: number): number {
  return Math.max(0, layoutHeight - visibleHeight - offsetTop);
}
