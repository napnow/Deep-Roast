export const POLISH_PROMPT_CREDIT_COST = 1;

export function promptPolishError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "提示词润色失败，请稍后重试";
}

export function parsePromptPolishResponse(value: unknown): {
  prompt: string;
  model?: string;
} {
  if (!value || typeof value !== "object") {
    throw new Error("模型未返回有效的润色结果");
  }
  const record = value as { prompt?: unknown; model?: unknown };
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  if (!prompt) throw new Error("模型未返回有效的润色结果");
  if (prompt.length > 12_000) {
    throw new Error("润色结果超过 12000 个字符，请缩短原文后重试");
  }
  return {
    prompt,
    model: typeof record.model === "string" ? record.model : undefined,
  };
}
