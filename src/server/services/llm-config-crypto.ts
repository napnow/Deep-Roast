import { decryptApiKey, encryptApiKey } from "./api-key-crypto";

export interface EncryptedLlmConfigKey {
  plaintext: string;
  ciphertext: string | null;
  iv: string | null;
  authTag: string | null;
}

export function encryptLlmConfigKey(
  plainKey: string,
  encodedKey?: string,
): EncryptedLlmConfigKey {
  const value = plainKey.trim();
  if (!value) {
    return { plaintext: "", ciphertext: null, iv: null, authTag: null };
  }
  const encrypted = encryptApiKey(value, encodedKey);
  return {
    plaintext: "",
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
  };
}

export function decryptLlmConfigKey(
  payload: {
    ciphertext: string | null;
    iv: string | null;
    authTag: string | null;
  },
  encodedKey?: string,
): string {
  if (!payload.ciphertext || !payload.iv || !payload.authTag) return "";
  return decryptApiKey(
    {
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      authTag: payload.authTag,
    },
    encodedKey,
  );
}

export function resolveLlmConfigKey(row: {
  arkApiKey?: string | null;
  arkApiKeyCiphertext?: string | null;
  arkApiKeyIv?: string | null;
  arkApiKeyAuthTag?: string | null;
}): string {
  if (row.arkApiKeyCiphertext && row.arkApiKeyIv && row.arkApiKeyAuthTag) {
    return decryptLlmConfigKey(
      {
        ciphertext: row.arkApiKeyCiphertext,
        iv: row.arkApiKeyIv,
        authTag: row.arkApiKeyAuthTag,
      },
      process.env.API_KEY_ENCRYPTION_KEY,
    );
  }
  return row.arkApiKey?.trim() || "";
}
