export type ImageEditMode = "per-image" | "reference";

export interface ImageEditItemInput {
  image: string;
  prompt?: string;
  targetIndex?: number;
  sourceImageId?: string;
}

export interface ImageEditRequest {
  mode?: ImageEditMode;
  image?: string | string[];
  prompt?: string;
  items?: ImageEditItemInput[];
  targetImage?: string;
  sourceImageId?: string;
  targetIndex?: number;
  referenceImages?: string[];
  model?: string;
  size?: string;
  count?: number;
}

export interface ImageEditTaskBase {
  /** Untrusted until verified against the user and target image. */
  sourceImageId?: string;
  targetImage: string;
  prompt: string;
  targetIndex: number;
}

export type ImageEditTask =
  | ({ mode: "per-image" } & ImageEditTaskBase)
  | ({ mode: "reference"; referenceImages: string[] } & ImageEditTaskBase);
