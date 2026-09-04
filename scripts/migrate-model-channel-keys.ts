import { db } from "@/db";
import { llmChannels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptModelChannelKey } from "@/server/services/model-channels";

async function main() {
  const encryptionKey = process.env.API_KEY_ENCRYPTION_KEY?.trim();
  if (!encryptionKey) {
    throw new Error("API_KEY_ENCRYPTION_KEY is required");
  }

  const migratedCount = await db.transaction(async (tx) => {
    const channels = await tx
      .select({
        id: llmChannels.id,
        apiKey: llmChannels.apiKey,
        apiKeyCiphertext: llmChannels.apiKeyCiphertext,
        apiKeyIv: llmChannels.apiKeyIv,
        apiKeyAuthTag: llmChannels.apiKeyAuthTag,
      })
      .from(llmChannels);

    let count = 0;
    for (const channel of channels) {
      const plaintext = channel.apiKey?.trim() || "";
      if (!plaintext) continue;
      if (
        channel.apiKeyCiphertext ||
        channel.apiKeyIv ||
        channel.apiKeyAuthTag
      ) {
        throw new Error(
          `Model channel ${channel.id} has both plaintext and encrypted key data`,
        );
      }

      const encrypted = encryptModelChannelKey(plaintext, encryptionKey);
      await tx
        .update(llmChannels)
        .set({
          apiKey: encrypted.plaintext,
          apiKeyCiphertext: encrypted.ciphertext,
          apiKeyIv: encrypted.iv,
          apiKeyAuthTag: encrypted.authTag,
          updatedAt: new Date(),
        })
        .where(eq(llmChannels.id, channel.id));
      count += 1;
    }
    return count;
  });

  console.log(
    migratedCount > 0
      ? `Encrypted ${migratedCount} model channel API Key(s)`
      : "No plaintext model channel API Keys found",
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Model channel key migration failed",
  );
  process.exitCode = 1;
});
