/**
 * 服务端 HTTP 辅助：统一错误与成功响应。
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  headers?: Record<string, string>;

  constructor(
    message: string,
    status = 400,
    code?: string,
    headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function jsonOk<T>(data: T, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export function privateNoStore(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const API_V1_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function addApiV1CorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(API_V1_CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function apiV1CorsPreflight(): Response {
  return new Response(null, { status: 204, headers: API_V1_CORS_HEADERS });
}

export const DEFAULT_JSON_MAX_BYTES = 1024 * 1024;
export const IMAGE_EDIT_JSON_MAX_BYTES = 30 * 1024 * 1024;

export function jsonError(err: unknown, fallback = "服务器错误"): Response {
  if (err instanceof ApiError) {
    const body: { error: string; code?: string } = { error: err.message };
    if (err.code) body.code = err.code;
    return Response.json(body, {
      status: err.status,
      headers: err.headers,
    });
  }
  console.error(err);
  return Response.json({ error: fallback }, { status: 500 });
}

/** 包装 route handler，自动捕获 ApiError */
export function handleRoute<TContext = unknown>(
  fn: (req: Request, context: TContext) => Promise<Response>,
): (req: Request, context: TContext) => Promise<Response> {
  return async (req, context) => {
    const isApiV1 = new URL(req.url).pathname.startsWith("/api/v1/");
    const finalize = (response: Response) =>
      isApiV1 ? addApiV1CorsHeaders(response) : response;
    try {
      return finalize(await fn(req, context));
    } catch (err) {
      return finalize(jsonError(err));
    }
  };
}

export async function readJson<T = Record<string, unknown>>(
  req: Request,
  options: { maxBytes?: number } = {},
): Promise<T> {
  const maxBytes = options.maxBytes ?? DEFAULT_JSON_MAX_BYTES;
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError("请求体过大", 413, "PAYLOAD_TOO_LARGE");
  }
  if (!req.body) throw new ApiError("请求体必须是 JSON", 400);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel("payload too large");
        throw new ApiError("请求体过大", 413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("请求体必须是 JSON", 400);
  } finally {
    reader.releaseLock();
  }
}
