import { ApiError } from "@/server/http";

export function canUseImageGeneration(
  role: string,
  enabled: boolean,
): boolean {
  return role === "admin" || enabled;
}

export function assertImageGenerationPolicy(
  role: string,
  enabled: boolean,
): void {
  if (!canUseImageGeneration(role, enabled)) {
    throw new ApiError(
      "生图功能暂时关闭",
      403,
      "IMAGE_GENERATION_DISABLED",
    );
  }
}
