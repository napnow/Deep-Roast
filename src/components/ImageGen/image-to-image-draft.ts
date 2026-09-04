import type { ImageToImageDraft } from "@/lib/image-workspace";
import type { ImageEditUiState } from "./image-edit-ui";

export interface Img2ImgDraftState {
  refs: ImageToImageDraft["refs"];
  edit: string;
  perImagePrompts: string[];
  editMode: ImageEditUiState["mode"];
  targetIndex: number;
  referenceIndexes: number[];
  editSize: string;
  batchCount: number;
  styleId: string;
  styleColor: string;
  styleTexture: string;
}

/** Converts a saved workspace draft into the local state used by the img2img panel. */
export function hydrateImg2ImgDraft(draft: ImageToImageDraft): Img2ImgDraftState {
  return {
    refs: draft.refs,
    edit: draft.prompt,
    perImagePrompts: draft.refs.map(() => draft.prompt),
    editMode: "per-image",
    targetIndex: 0,
    referenceIndexes: [],
    editSize: draft.size,
    batchCount: draft.count,
    styleId: draft.styleId,
    styleColor: draft.styleColor,
    styleTexture: draft.styleTexture,
  };
}
