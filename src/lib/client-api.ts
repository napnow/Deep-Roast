/**
 * 浏览器端轻量 API 封装，统一错误与 JSON 解析。
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  raw?: unknown;

  constructor(message: string, status: number, code?: string, raw?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.raw = raw;
  }
}

export async function apiJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string })?.error || `请求失败 (${res.status})`,
      res.status,
      (data as { code?: string })?.code,
      data,
    );
  }

  return data as T;
}

export function jsonBody(data: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
