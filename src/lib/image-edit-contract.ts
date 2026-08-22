export type ImageEditMode = "per-image" | "reference";

export interface ImageEditItemInput {
  image: string;
  prompt?: string;
  targetIndex?: number;
}

export interface ImageEditRequest {
  mode?: ImageEditMode;
  image?: string | string[];
  prompt?: string;
  items?: ImageEditItemInput[];
  targetImage?: string;
  targetIndex?: number;
  referenceImages?: string[];
  model?: string;
  size?: string;
  count?: number;
}

export interface ImageEditTaskBase {
  targetImage: string;
  prompt: string;
  targetIndex: number;
}

export type ImageEditTask =
  | ({ mode: "per-image" } & ImageEditTaskBase)
  | ({ mode: "reference"; referenceImages: string[] } & ImageEditTaskBase);
