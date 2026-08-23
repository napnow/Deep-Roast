export interface ModelCatalogRequestInput {
  baseUrl: string;
  savedBaseUrl: string;
  apiKey: string;
  hasSavedApiKey: boolean;
}

export type ModelCatalogRequestDecision =
  | { kind: "request"; method: "GET" }
  | {
      kind: "request";
      method: "POST";
      body: { baseUrl: string; apiKey: string };
    }
  | { kind: "error"; message: string };

export function decideModelCatalogRequest(
  input: ModelCatalogRequestInput,
): ModelCatalogRequestDecision {
  const baseUrl = input.baseUrl.trim();
  const savedBaseUrl = input.savedBaseUrl.trim();
  const apiKey = input.apiKey.trim();

  if (!baseUrl) {
    return { kind: "error", message: "请先在上方填写 API Base URL" };
  }

  if (apiKey) {
    return {
      kind: "request",
      method: "POST",
      body: { baseUrl, apiKey },
    };
  }

  if (!input.hasSavedApiKey) {
    return { kind: "error", message: "请先在上方填写 API Key" };
  }

  if (baseUrl !== savedBaseUrl) {
    return {
      kind: "error",
      message: "修改 Base URL 时请重新输入 API Key",
    };
  }

  return { kind: "request", method: "GET" };
}
