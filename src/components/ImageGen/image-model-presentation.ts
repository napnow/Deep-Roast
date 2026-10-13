const IMAGE_MODEL_LABELS: Record<string, string> = {
  "gpt-image-2": "GPT Image 2",
  "gpt-image-2.5-flare": "GPT Image 2.5 · Flare",
  "gpt-image-2.5-sunburst": "GPT Image 2.5 · Sunburst",
  "doubao-seedream-4-5-251128": "Seedream 4.5",
  "grok-imagine-image-lite": "Grok Imagine Lite",
};

export function getImageModelLabel(modelId: string): string {
  return IMAGE_MODEL_LABELS[modelId] || modelId || "模型未配置";
}
