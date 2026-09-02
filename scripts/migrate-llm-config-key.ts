import { db } from "@/db";
import { llmConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptLlmConfigKey } from "@/server/services/llm-config-crypto";

async function main() {
  const encryptionKey = process.env.API_KEY_ENCRYPTION_KEY?.trim();
  if (!encryptionKey) {
    throw new Error("API_KEY_ENCRYPTION_KEY is required");
  }

  const migrated = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: llmConfig.id,
        arkApiKey: llmConfig.arkApiKey,
        ciphertext: llmConfig.arkApiKeyCiphertext,
        iv: llmConfig.arkApiKeyIv,
        authTag: llmConfig.arkApiKeyAuthTag,
      })
      .from(llmConfig)
      .where(eq(llmConfig.id, 1));

    if (!row || !row.arkApiKey?.trim()) return false;
    if (row.ciphertext && row.iv && row.authTag) {
      throw new Error("LLM config already has encrypted key but legacy key is non-empty");
    }

    const encrypted = encryptLlmConfigKey(row.arkApiKey, encryptionKey);
    await tx
      .update(llmConfig)
      .set({
        arkApiKey: encrypted.plaintext,
        arkApiKeyCiphertext: encrypted.ciphertext,
        arkApiKeyIv: encrypted.iv,
        arkApiKeyAuthTag: encrypted.authTag,
        updatedAt: new Date(),
      })
      .where(eq(llmConfig.id, row.id));
    return true;
  });

  console.log(
    migrated
      ? "LLM config API Key migrated"
      : "No plaintext LLM config API Key found",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "LLM config migration failed");
  process.exitCode = 1;
});
