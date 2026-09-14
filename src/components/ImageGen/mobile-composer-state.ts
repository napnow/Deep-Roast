export const MOBILE_COMPOSER_DRAG_THRESHOLD = 36;

export function resolveMobileComposerDrag(
  startY: number,
  endY: number,
  expanded: boolean,
): boolean {
  const distance = endY - startY;
  if (distance <= -MOBILE_COMPOSER_DRAG_THRESHOLD) return true;
  if (distance >= MOBILE_COMPOSER_DRAG_THRESHOLD) return false;
  return expanded;
}
