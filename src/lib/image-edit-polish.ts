import type { ImageEditUiState } from "@/components/ImageGen/image-edit-ui";

export interface ImageEditPolishState {
  mode: ImageEditUiState["mode"];
  prompts: string[];
  edit: string;
  targetIndex: number;
  undo?: {
    original: string;
    polished: string;
    ownerIndex: number;
  } | null;
}

export function createImageEditPolishState(
  input: Omit<ImageEditPolishState, "undo">,
): ImageEditPolishState {
  return { ...input, undo: null };
}

export function withImageEditPolishUndo(
  state: Omit<ImageEditPolishState, "undo">,
  undo: NonNullable<ImageEditPolishState["undo"]>,
): ImageEditPolishState {
  return { ...state, undo };
}

/** Returns the instruction currently shown in the image-to-image editor. */
export function getImageEditPolishTarget(state: ImageEditPolishState): string {
  return state.mode === "per-image" && state.prompts.length > 0
    ? state.prompts[state.targetIndex] || ""
    : state.edit;
}

/**
 * Commit a polish result only to the editor that owned the original text.
 * Other per-image instructions and the shared instruction stay untouched.
 */
export function commitImageEditPolish(
  state: ImageEditPolishState,
  result: { original: string; polished: string },
): ImageEditPolishState {
  const isPerImage = state.mode === "per-image" && state.prompts.length > 0;
  const ownerIndex = state.targetIndex;
  if (
    isPerImage
      ? state.prompts[ownerIndex] !== result.original
      : state.edit !== result.original
  ) {
    return state;
  }
  const prompts = isPerImage
    ? state.prompts.map((prompt, index) =>
        index === ownerIndex ? result.polished : prompt,
      )
    : state.prompts;
  return {
    ...state,
    prompts,
    edit: isPerImage ? state.edit : result.polished,
    undo: {
      ...result,
      ownerIndex,
    },
  };
}

export function restoreImageEditPolish(
  state: ImageEditPolishState,
  current: Pick<ImageEditPolishState, "edit" | "prompts">,
): Pick<ImageEditPolishState, "edit" | "prompts"> {
  if (!state.undo) return current;
  const isPerImage = state.mode === "per-image" && state.prompts.length > 0;
  // Undo belongs to the image that produced the result. Switching editors or
  // changing that text makes the stale action a no-op.
  if (isPerImage && state.targetIndex !== state.undo.ownerIndex) return current;
  if (!isPerImage && current.edit !== state.undo.polished) return current;
  return {
    edit: isPerImage ? current.edit : state.undo.original,
    prompts: isPerImage
      ? current.prompts.map((prompt, index) =>
          index === state.undo!.ownerIndex && prompt === state.undo!.polished
            ? state.undo!.original
            : prompt,
        )
      : current.prompts,
  };
}
