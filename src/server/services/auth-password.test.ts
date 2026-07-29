import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_PASSWORD_LENGTH,
  assertPasswordLength,
  generateTemporaryPassword,
} from "./auth-password";
import { ApiError } from "../http";

describe("password policy", () => {
  it("exports min length 8", () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8);
  });

  it("assertPasswordLength rejects short passwords", () => {
    assert.throws(() => assertPasswordLength("1234567"), (err: unknown) => {
      return err instanceof ApiError && err.status === 400;
    });
  });

  it("assertPasswordLength accepts length 8+", () => {
    assert.doesNotThrow(() => assertPasswordLength("12345678"));
  });

  it("generateTemporaryPassword returns 12 alnum chars by default", () => {
    const p = generateTemporaryPassword();
    assert.equal(p.length, 12);
    assert.match(p, /^[A-Za-z0-9]+$/);
    // ambiguous chars excluded
    assert.doesNotMatch(p, /[0OIl1]/);
  });

  it("generateTemporaryPassword is not constant", () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    // Extremely unlikely to collide; if flaky re-run once
    assert.notEqual(a, b);
  });
});
