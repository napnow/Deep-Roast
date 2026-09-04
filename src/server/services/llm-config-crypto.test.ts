import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decryptLlmConfigKey,
  encryptLlmConfigKey,
} from "./llm-config-crypto";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("LLM config key encryption", () => {
  it("round-trips without returning a plaintext database field", () => {
    const encrypted = encryptLlmConfigKey("server-secret", TEST_KEY);
    assert.equal(encrypted.plaintext, "");
    assert.ok(encrypted.ciphertext);
    assert.ok(encrypted.iv);
    assert.ok(encrypted.authTag);
    assert.equal(decryptLlmConfigKey(encrypted, TEST_KEY), "server-secret");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptLlmConfigKey("server-secret", TEST_KEY);
    if (!encrypted.ciphertext) throw new Error("ciphertext missing");
    const tampered =
      (encrypted.ciphertext[0] === "A" ? "B" : "A") +
      encrypted.ciphertext.slice(1);
    assert.throws(() =>
      decryptLlmConfigKey(
        { ...encrypted, ciphertext: tampered },
        TEST_KEY,
      ),
    );
  });
});
