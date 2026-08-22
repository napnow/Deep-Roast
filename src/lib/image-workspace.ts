export interface DraftReference {
  preview: string;
  base64: string;
}

export interface TextToImageDraft {
  prompt: string;
  size: string;
  count: number;
  stylePrompt: string;
}

export interface ImageToImageDraft {
  prompt: string;
  size: string;
  count: number;
  styleId: string;
  styleColor: string;
  styleTexture: string;
  refs: DraftReference[];
}

export interface ReversePromptDraft {
  image: string | null;
  resultPrompt: string;
}

export function generationCost(count: number, perImage: number): number {
  const safeCount = Math.min(Math.max(Math.floor(count) || 1, 1), 5);
  return safeCount * perImage;
}

export function applyReversePrompt(
  draft: TextToImageDraft,
  prompt: string,
): TextToImageDraft {
  return { ...draft, prompt };
}
