import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import { shouldRetryImageError } from "./image";

describe("image retry policy", () => {
  it("does not retry insufficient credits", () => {
    assert.equal(
      shouldRetryImageError(
        new ApiError("积分不足", 402, "INSUFFICIENT_CREDITS"),
      ),
      false,
    );
  });

  it("retries a transient upstream error", () => {
    assert.equal(shouldRetryImageError(new TypeError("network timeout")), true);
  });

  it("does not retry an unclassified programming error", () => {
    assert.equal(shouldRetryImageError(new Error("unexpected state")), false);
  });
});
