export interface CreationSettingsInput {
  styleLabel?: string;
  sizeLabel?: string;
  batchCount?: number;
}

export interface MobileCreationSurface {
  sheetOpen: boolean;
  appMode: "image" | "chat";
}

export const WORKBENCH_CLASS_NAMES = {
  panel: "creation-panel",
  settings: "creation-settings",
  mobileSheet: "mobile-creation-sheet",
} as const;

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
