export type CanvasVariantResults<T> = {
  values: T[];
  errors: unknown[];
};

export async function settleCanvasVariantRequests<T>(
  count: number,
  request: () => Promise<T>,
): Promise<CanvasVariantResults<T>> {
  const attempts = Math.max(0, Math.floor(count));
  const settled = await Promise.allSettled(
    Array.from({ length: attempts }, () => request()),
  );
  return settled.reduce<CanvasVariantResults<T>>((result, item) => {
    if (item.status === "fulfilled") result.values.push(item.value);
    else result.errors.push(item.reason);
    return result;
  }, { values: [], errors: [] });
}
