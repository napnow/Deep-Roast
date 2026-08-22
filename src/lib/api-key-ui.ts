export function canDismissCreatedKey(acknowledged: boolean) {
  return acknowledged;
}

export function extractPlainApiKey(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.plainKey === "string" && record.plainKey.trim()) {
    return record.plainKey.trim();
  }
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    if (typeof nested.plainKey === "string" && nested.plainKey.trim()) {
      return nested.plainKey.trim();
    }
  }
  return "";
}

export function apiKeyStatusLabel(status: "active" | "disabled") {
  return status === "active" ? "已启用" : "已停用";
}

export function maskApiKey(prefix: string) {
  return `${prefix}••••••••`;
}

export function apiKeyRecoveryLabel(recoverable: boolean) {
  return recoverable ? "可随时显示和复制" : "旧版 Key，无法恢复";
}

export function buildApiCurlExample(origin: string) {
  const normalizedOrigin = origin.replace(/\/$/, "");
  return `curl ${normalizedOrigin}/api/v1/images/generations \\
  -H "Authorization: Bearer sk-dr-你的Key" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"<生图模型>","prompt":"一只猫","size":"1024x1024","n":1}'`;
}
