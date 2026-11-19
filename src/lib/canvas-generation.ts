export type CanvasVariantResults<T> = {
  values: T[];
  errors: unknown[];
};

export type CanvasGenerateContext = {
  signal: AbortSignal;
};

export async function settleCanvasVariantRequests<T>(
  count: number,
  request: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<CanvasVariantResults<T>> {
  const attempts = Math.max(0, Math.floor(count));
  const values: T[] = [];
  const errors: unknown[] = [];
  for (let index = 0; index < attempts; index += 1) {
    if (signal?.aborted) break;
    try {
      values.push(await request(signal));
    } catch (error) {
      errors.push(error);
    }
  }
  return { values, errors };
}
