/**
 * 服务端 HTTP 辅助：统一错误与成功响应。
 */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function jsonError(err: unknown, fallback = "服务器错误"): Response {
  if (err instanceof ApiError) {
    const body: { error: string; code?: string } = { error: err.message };
    if (err.code) body.code = err.code;
    return Response.json(body, { status: err.status });
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
    try {
      return await fn(req, context);
    } catch (err) {
      return jsonError(err);
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
