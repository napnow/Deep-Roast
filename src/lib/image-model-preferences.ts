export const IMAGE_MODEL_PREFERENCE_STORAGE_KEY =
  "deep-roast-selected-image-model";

function normalizeModelId(model: string | null | undefined): string {
  return typeof model === "string" ? model.trim() : "";
}

/** Resolve the browser preference against the model list returned by the server. */
export function resolveImageModelPreference(
  storedModel: string | null | undefined,
  enabledModels: readonly string[],
  defaultModel: string | null | undefined,
): string {
  const enabled = [
    ...new Set(enabledModels.map(normalizeModelId).filter(Boolean)),
  ];
  const stored = normalizeModelId(storedModel);
  const fallback = normalizeModelId(defaultModel);

  if (stored && enabled.length > 0 && enabled.includes(stored)) {
    return stored;
  }
  if (!enabled.length || (fallback && enabled.includes(fallback))) {
    return fallback;
  }
  return enabled[0] || fallback;
}

/**
 * Resolve config hydration without overwriting a selection made while the
 * request was in flight.
 */
export function resolveImageModelAfterConfigLoad(
  storedModel: string | null | undefined,
  selectedModelAtRequestStart: string | null | undefined,
  selectedModelAfterRequest: string | null | undefined,
  enabledModels: readonly string[],
  defaultModel: string | null | undefined,
): string {
  const selectedAtStart = normalizeModelId(selectedModelAtRequestStart);
  const selectedAfterRequest = normalizeModelId(selectedModelAfterRequest);
  const candidate =
    selectedAfterRequest !== selectedAtStart ? selectedAfterRequest : storedModel;
  return resolveImageModelPreference(candidate, enabledModels, defaultModel);
}
