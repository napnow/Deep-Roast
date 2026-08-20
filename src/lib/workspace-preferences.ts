export type WorkspaceMode = "image" | "chat";
export type ImageCreationMode = "text" | "edit" | "reverse";
export type InspectorTab = "history" | "details";

export function parseStoredWorkspaceMode(
  value: string | null,
): WorkspaceMode {
  return value === "chat" ? "chat" : "image";
}

export function parseStoredBoolean(
  value: string | null,
  fallback: boolean,
): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}
