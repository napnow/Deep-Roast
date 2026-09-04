import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptApiKey, encryptApiKey } from "./api-key-crypto";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("API key authenticated encryption", () => {
  it("round-trips a key without storing plaintext", () => {
    const encrypted = encryptApiKey("sk-dr-secret", TEST_KEY);

    assert.equal(decryptApiKey(encrypted, TEST_KEY), "sk-dr-secret");
    assert.notEqual(encrypted.ciphertext, "sk-dr-secret");
  });

  it("uses a fresh IV for every encryption", () => {
    const first = encryptApiKey("sk-dr-secret", TEST_KEY);
    const second = encryptApiKey("sk-dr-secret", TEST_KEY);

    assert.notEqual(first.iv, second.iv);
    assert.notEqual(first.ciphertext, second.ciphertext);
  });

  it("rejects missing or malformed encryption configuration", () => {
    assert.throws(() => encryptApiKey("sk-dr-secret", ""), /加密配置/);
    assert.throws(() => encryptApiKey("sk-dr-secret", "not-base64"), /加密配置/);
    assert.throws(() => encryptApiKey("sk-dr-secret", `${TEST_KEY}!`), /加密配置/);
  });

  it("rejects tampered authentication data", () => {
    const encrypted = encryptApiKey("sk-dr-secret", TEST_KEY);

    assert.throws(() =>
      decryptApiKey({ ...encrypted, authTag: Buffer.alloc(16, 1).toString("base64") }, TEST_KEY),
    );
  });
});
