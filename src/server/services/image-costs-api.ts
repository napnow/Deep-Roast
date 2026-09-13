import { db } from "@/db";
import { imageModelCreditCosts } from "@/db/schema";
import { getConfig, defaultImageModelIds } from "@/lib/config";
import { ApiError } from "@/server/http";
import {
  buildImageModelCreditCosts,
  getImageModelCreditCosts,
  parseImageModelCreditCost,
} from "@/server/services/image-costs";
import {
  listConfiguredModelIds,
  listModelChannels,
} from "@/server/services/model-channels";

export function normalizeImageModelCostMap(
  value: unknown,
): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("imageModelCosts 必须是对象", 400, "INVALID_IMAGE_MODEL_COSTS");
  }

  const result: Record<string, number> = {};
  for (const [rawModelId, rawCost] of Object.entries(value)) {
    const modelId = rawModelId.trim();
    if (!modelId || Object.prototype.hasOwnProperty.call(result, modelId)) {
      throw new ApiError(
        "图片模型 ID 不能为空或重复",
        400,
        "INVALID_IMAGE_MODEL_COSTS",
      );
    }
    result[modelId] = parseImageModelCreditCost(rawCost);
  }
  return result;
}

export async function listEnabledImageModelIds(): Promise<string[]> {
  const config = await getConfig();
  if (!config) return defaultImageModelIds();
  const channels = await listModelChannels();
  const modelIds = await listConfiguredModelIds(config, "image");
  if (channels.length > 0) return modelIds;
  return modelIds.length > 0 ? modelIds : defaultImageModelIds();
}

async function listStoredImageModelCreditCostIds(): Promise<string[]> {
  try {
    const rows = await db
      .select({ modelId: imageModelCreditCosts.modelId })
      .from(imageModelCreditCosts);
    return rows.map((row) => row.modelId);
  } catch {
    return [];
  }
}

export function buildAdminImageModelCreditCosts(
  enabledModelIds: string[],
  rows: Array<{
    modelId: string;
    creditsPerImage: number | null | undefined;
  }>,
): Record<string, number> {
  return buildImageModelCreditCosts(
    [...new Set([...rows.map((row) => row.modelId), ...enabledModelIds])],
    rows,
  );
}

export async function getAdminImageModelCosts() {
  const enabledModelIds = await listEnabledImageModelIds();
  try {
    const rows = await db
      .select({
        modelId: imageModelCreditCosts.modelId,
        creditsPerImage: imageModelCreditCosts.creditsPerImage,
      })
      .from(imageModelCreditCosts);
    return {
      imageModelCosts: buildAdminImageModelCreditCosts(enabledModelIds, rows),
    };
  } catch {
    return {
      imageModelCosts: await getImageModelCreditCosts(enabledModelIds),
    };
  }
}

export async function updateAdminImageModelCosts(value: unknown) {
  const requested = normalizeImageModelCostMap(value);
  if (Object.keys(requested).length === 0) {
    return getAdminImageModelCosts();
  }

  const enabledModelIds = new Set([
    ...(await listEnabledImageModelIds()),
    ...(await listStoredImageModelCreditCostIds()),
  ]);
  for (const modelId of Object.keys(requested)) {
    if (!enabledModelIds.has(modelId)) {
      throw new ApiError(`图片模型不可用：${modelId}`, 400, "INVALID_IMAGE_MODEL");
    }
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const [modelId, creditsPerImage] of Object.entries(requested)) {
      await tx
        .insert(imageModelCreditCosts)
        .values({ modelId, creditsPerImage, updatedAt: now })
        .onConflictDoUpdate({
          target: imageModelCreditCosts.modelId,
          set: { creditsPerImage, updatedAt: now },
        });
    }
  });
  return getAdminImageModelCosts();
}
