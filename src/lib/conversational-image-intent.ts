export const DEFAULT_ASSISTANT_IMAGE_PROMPT =
  "A fictional adult virtual assistant portrait, warm natural expression, tasteful contemporary clothing, soft daylight, editorial lifestyle photography, no text, no watermark";

const APPEARANCE_PATTERNS = [
  /我想看看你/,
  /给我看看你的?(样子|脸|照片|长相)/,
  /想看看你的?(样子|脸|照片|长相)/,
  /你(长什么样|是什么样子)/,
];

export interface AssistantAppearanceIntent {
  prompt: string;
}

export function detectAssistantAppearanceIntent(
  message: string,
): AssistantAppearanceIntent | null {
  const prompt = message.trim();
  const normalized = prompt.replace(/[\s，。！？、,.!?]/g, "");
  if (
    !normalized ||
    !APPEARANCE_PATTERNS.some((pattern) => pattern.test(normalized))
  ) {
    return null;
  }
  return { prompt };
}
