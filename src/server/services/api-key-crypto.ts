import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface EncryptedApiKey {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function resolveEncryptionKey(encodedKey?: string): Buffer {
  const value = encodedKey ?? process.env.API_KEY_ENCRYPTION_KEY ?? "";
  const normalized = value.trim();
  const key = Buffer.from(normalized, "base64");
  const canonical = key.toString("base64");
  if (!normalized || key.length !== KEY_BYTES || canonical !== normalized) {
    throw new Error("API Key 加密配置无效");
  }
  return key;
}

export function encryptApiKey(plainKey: string, encodedKey?: string): EncryptedApiKey {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, resolveEncryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(plainKey, "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptApiKey(payload: EncryptedApiKey, encodedKey?: string): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    resolveEncryptionKey(encodedKey),
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
