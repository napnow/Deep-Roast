export interface CreationSettingsInput {
  styleLabel?: string;
  sizeLabel?: string;
  batchCount?: number;
}

export interface MobileCreationSurface {
  sheetOpen: boolean;
  appMode: "image" | "chat";
}

export interface CreationPanelBounds {
  min: number;
  max: number;
}

export const CREATION_PANEL_LAYOUT = {
  defaultWidth: 440,
  minWidth: 360,
  maxWidth: 560,
  minResultWidth: 420,
  keyboardStep: 16,
  storageKey: "deep-roast-creation-panel-width",
} as const;

export const WORKBENCH_CLASS_NAMES = {
  panel: "creation-panel",
  roomyPanel: "creation-panel--roomy",
  richPanel: "creation-panel--rich",
  step: "creation-step-card",
  statusStrip: "creation-status-strip",
  taskCard: "creation-task-card",
  settings: "creation-settings",
  mobileSheet: "mobile-creation-sheet",
} as const;

export function getCreationPanelBounds(
  viewportWidth: number,
  inspectorWidth = 312,
): CreationPanelBounds {
  const safeViewport = Number.isFinite(viewportWidth) ? viewportWidth : 0;
  const safeInspector = Number.isFinite(inspectorWidth)
    ? Math.max(0, inspectorWidth)
    : 312;
  const availableMax =
    safeViewport - safeInspector - CREATION_PANEL_LAYOUT.minResultWidth;

  return {
    min: CREATION_PANEL_LAYOUT.minWidth,
    max: Math.max(
      CREATION_PANEL_LAYOUT.minWidth,
      Math.min(CREATION_PANEL_LAYOUT.maxWidth, availableMax),
    ),
  };
}

export function clampCreationPanelWidth(
  width: number,
  bounds: CreationPanelBounds,
): number {
  const fallback = CREATION_PANEL_LAYOUT.defaultWidth;
  const numericWidth = Number.isFinite(width) ? width : fallback;
  return Math.min(bounds.max, Math.max(bounds.min, numericWidth));
}

export function parseCreationPanelWidth(
  value: string | null,
  bounds: CreationPanelBounds,
): number {
  const parsed = value === null ? NaN : Number(value);
  return clampCreationPanelWidth(parsed, bounds);
}

export function getCreationPanelKeyboardWidth(
  width: number,
  key: string,
  bounds: CreationPanelBounds,
): number {
  const current = clampCreationPanelWidth(width, bounds);
  if (key === "ArrowLeft") {
    return clampCreationPanelWidth(
      current - CREATION_PANEL_LAYOUT.keyboardStep,
      bounds,
    );
  }
  if (key === "ArrowRight") {
    return clampCreationPanelWidth(
      current + CREATION_PANEL_LAYOUT.keyboardStep,
      bounds,
    );
  }
  if (key === "Home") return bounds.min;
  if (key === "End") return bounds.max;
  return current;
}

export function getCreationSettingsSummary(
  input: CreationSettingsInput,
): string[] {
  const labels = [input.styleLabel?.trim(), input.sizeLabel?.trim()];
  if (input.batchCount && input.batchCount > 0) {
    labels.push(`${input.batchCount} 张`);
  }
  return labels.filter((label): label is string => Boolean(label));
}

export function getActiveEditPrompt(
  prompts: string[],
  index: number,
): string {
  return Number.isInteger(index) && index >= 0 ? prompts[index] || "" : "";
}

export function getMobileCreationSurface(
  tool: "img2img" | "chat",
  appMode: "image" | "chat",
): MobileCreationSurface {
  return {
    sheetOpen: tool === "img2img" && appMode === "image",
    appMode,
  };
}
