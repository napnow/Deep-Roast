import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_IDEMPOTENCY_KEY_LENGTH,
  normalizeIdempotencyKey,
  providerIdempotencyKey,
} from "./request-idempotency";

describe("request idempotency contract", () => {
  it("requires a non-empty bounded key", () => {
    assert.throws(
      () => normalizeIdempotencyKey(""),
      (error: unknown) =>
        error instanceof Error && error.message.includes("幂等"),
    );
    assert.throws(
      () => normalizeIdempotencyKey("x".repeat(MAX_IDEMPOTENCY_KEY_LENGTH + 1)),
    );
    assert.equal(normalizeIdempotencyKey("  checkout-1  "), "checkout-1");
  });

  it("derives stable provider keys per operation attempt", () => {
    assert.equal(
      providerIdempotencyKey("image", "checkout-1", 1),
      providerIdempotencyKey("image", "checkout-1", 1),
    );
    assert.notEqual(
      providerIdempotencyKey("image", "checkout-1", 1),
      providerIdempotencyKey("image", "checkout-1", 2),
    );
    assert.notEqual(
      providerIdempotencyKey("image", "checkout-1", 1),
      providerIdempotencyKey("chat", "checkout-1", 1),
    );
  });
});
