import { ApiError } from "@/server/http";
import { canUseImageGeneration } from "@/lib/image-generation-access";

export { canUseImageGeneration } from "@/lib/image-generation-access";

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
