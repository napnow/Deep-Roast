import { db } from "@/db";
import { imageModelCreditCosts } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { ApiError } from "@/server/http";
import { DEFAULT_IMAGE_MODEL_CREDIT_COST } from "@/types";

export { DEFAULT_IMAGE_MODEL_CREDIT_COST };
export const MAX_IMAGE_MODEL_CREDIT_COST = 2_147_483_647;

function invalidCostError(): ApiError {
  return new ApiError(
    "图片模型积分必须是大于等于 1 的安全正整数",
    400,
    "INVALID_IMAGE_CREDIT_COST",
  );
}

export function parseImageModelCreditCost(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : Number.NaN;
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_IMAGE_MODEL_CREDIT_COST
  ) {
    throw invalidCostError();
  }
  return parsed;
}

export function calculateImageCreditCost(
  perImage: number,
  count: number,
): number {
  const safePerImage = parseImageModelCreditCost(perImage);
  const safeCount = Math.min(Math.max(Math.floor(count) || 1, 1), 5);
  const total = safePerImage * safeCount;
  if (!Number.isSafeInteger(total)) throw invalidCostError();
  return total;
}

function isMissingRelation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "42P01"
  );
}

function safeStoredCost(value: number | null | undefined): number {
  try {
    return parseImageModelCreditCost(value);
  } catch {
    return DEFAULT_IMAGE_MODEL_CREDIT_COST;
  }
}

export function buildImageModelCreditCosts(
  modelIds: string[],
  rows: Array<{ modelId: string; creditsPerImage: number | null | undefined }>,
): Record<string, number> {
  const configured = new Map(
    rows.map((row) => [row.modelId, safeStoredCost(row.creditsPerImage)]),
  );
  return Object.fromEntries(
    [...new Set(modelIds.filter((modelId) => modelId.trim()))].map((modelId) => [
      modelId,
      configured.get(modelId) ?? DEFAULT_IMAGE_MODEL_CREDIT_COST,
    ]),
  );
}

export async function getImageModelCreditCost(
  modelId: string,
): Promise<number> {
  const normalized = modelId.trim();
  if (!normalized) return DEFAULT_IMAGE_MODEL_CREDIT_COST;
  try {
    const [row] = await db
      .select({ creditsPerImage: imageModelCreditCosts.creditsPerImage })
      .from(imageModelCreditCosts)
      .where(eq(imageModelCreditCosts.modelId, normalized))
      .limit(1);
    return safeStoredCost(row?.creditsPerImage);
  } catch (error) {
    if (!isMissingRelation(error)) {
      console.warn("读取图片模型积分配置失败，使用默认值", {
        modelId: normalized,
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
    return DEFAULT_IMAGE_MODEL_CREDIT_COST;
  }
}

export async function getImageModelCreditCosts(
  modelIds: string[],
): Promise<Record<string, number>> {
  const normalizedIds = [
    ...new Set(modelIds.map((modelId) => modelId.trim()).filter(Boolean)),
  ];
  if (normalizedIds.length === 0) return {};
  try {
    const rows = await db
      .select({
        modelId: imageModelCreditCosts.modelId,
        creditsPerImage: imageModelCreditCosts.creditsPerImage,
      })
      .from(imageModelCreditCosts)
      .where(inArray(imageModelCreditCosts.modelId, normalizedIds));
    return buildImageModelCreditCosts(normalizedIds, rows);
  } catch (error) {
    if (!isMissingRelation(error)) {
      console.warn("读取图片模型积分配置失败，使用默认值", {
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
    return buildImageModelCreditCosts(normalizedIds, []);
  }
}
