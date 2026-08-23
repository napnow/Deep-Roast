import {
  defaultTextModelIds,
  parseEnabledModels,
} from "@/lib/config";
import { ApiError } from "@/server/http";

export type TextModelAccessConfig = {
  enabledTextModels?: string | null;
  textModel?: string | null;
} | null;

export function assertEnabledTextModel(
  value: string,
  config: TextModelAccessConfig,
): string {
  const model = value.trim();
  const enabled = parseEnabledModels(
    config?.enabledTextModels,
    defaultTextModelIds(),
    config?.textModel,
  );
  if (!model || !enabled.includes(model)) {
    throw new ApiError("指定的模型不可用", 400);
  }
  return model;
}
