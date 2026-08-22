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
  const message =
    err instanceof Error && err.message ? err.message : fallback;
  return Response.json({ error: message }, { status: 500 });
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
): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError("请求体必须是 JSON", 400);
  }
}
