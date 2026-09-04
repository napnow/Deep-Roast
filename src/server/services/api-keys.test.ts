import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import {
  apiKeyUsageDelta,
  assertApiKeyOwnership,
  assertApiKeyQuota,
  hasRecoverableSecret,
  MAX_API_KEYS_PER_USER,
  normalizeApiKeyStatus,
} from "./api-keys";

describe("API key quota", () => {
  it("allows fewer than ten keys", () => {
    assert.doesNotThrow(() => assertApiKeyQuota(MAX_API_KEYS_PER_USER - 1));
  });

  it("rejects ten existing keys", () => {
    assert.throws(
      () => assertApiKeyQuota(MAX_API_KEYS_PER_USER),
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 429 &&
        err.code === "API_KEY_QUOTA",
    );
  });
});

describe("admin API key rules", () => {
  it("validates mutable statuses", () => {
    assert.equal(normalizeApiKeyStatus("active"), "active");
    assert.equal(normalizeApiKeyStatus("disabled"), "disabled");
    assert.throws(() => normalizeApiKeyStatus("revoked"));
  });

  it("normalizes usage accounting", () => {
    assert.deepEqual(apiKeyUsageDelta(12), { usageCount: 1, creditsConsumed: 12 });
    assert.deepEqual(apiKeyUsageDelta(-1), { usageCount: 1, creditsConsumed: 0 });
  });

  it("rejects cross-user key operations", () => {
    assert.doesNotThrow(() => assertApiKeyOwnership("a", "a"));
    assert.throws(() => assertApiKeyOwnership("a", "b"));
  });
});

describe("recoverable API key metadata", () => {
  it("requires ciphertext, IV, and authentication tag", () => {
    assert.equal(
      hasRecoverableSecret({ keyCiphertext: "cipher", keyIv: "iv", keyAuthTag: "tag" }),
      true,
    );
    assert.equal(
      hasRecoverableSecret({ keyCiphertext: "cipher", keyIv: null, keyAuthTag: "tag" }),
      false,
    );
    assert.equal(
      hasRecoverableSecret({ keyCiphertext: null, keyIv: null, keyAuthTag: null }),
      false,
    );
  });

  it("does not reveal whether another user's key exists", () => {
    assert.throws(
      () => assertApiKeyOwnership("owner", "other"),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 404 &&
        error.message === "Key 不存在",
    );
  });
});
