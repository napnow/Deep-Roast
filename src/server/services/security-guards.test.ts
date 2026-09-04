import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import { assertCanonicalPublicOrigin } from "./security-guards";

describe("public origin", () => {
  it("normalizes a HTTPS root URL", () => {
    assert.equal(
      assertCanonicalPublicOrigin("https://app.example.com/"),
      "https://app.example.com",
    );
  });

  it("rejects missing, HTTP, and path values", () => {
    for (const value of [
      undefined,
      "http://app.example.com",
      "https://app.example.com/path",
    ]) {
      assert.throws(
        () => assertCanonicalPublicOrigin(value),
        (err: unknown) => err instanceof ApiError && err.status === 500,
      );
    }
  });
});
