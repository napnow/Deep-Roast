import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import { assertAdminRole } from "./auth";

describe("admin authorization", () => {
  it("rejects ordinary users", () => {
    assert.throws(
      () => assertAdminRole("user"),
      (error: unknown) => error instanceof ApiError && error.status === 403,
    );
  });

  it("accepts admins", () => assert.doesNotThrow(() => assertAdminRole("admin")));
});
