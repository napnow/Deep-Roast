const IMAGE_MODEL_LABELS: Record<string, string> = {
  "gpt-image-2": "GPT Image 2",
  "gpt-image-2.5-flare": "GPT Image 2.5 · Flare",
  "gpt-image-2.5-sunburst": "GPT Image 2.5 · Sunburst",
  "gpt-image-2.6-flare": "GPT Image 2.6 · Flare",
  "gpt-image-2.6-sunburst": "GPT Image 2.6 · Sunburst",
  "gemini-3.1-flash-image-1k": "Gemini 3.1 Flash · 1K",
  "gemini-3.1-flash-image-2k": "Gemini 3.1 Flash · 2K",
};

export function getImageModelLabel(modelId: string): string {
  return IMAGE_MODEL_LABELS[modelId] || modelId || "模型未配置";
}
