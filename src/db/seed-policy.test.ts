import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireAdminSeedPassword } from "./seed-policy";

describe("administrator seed password", () => {
  it("rejects a missing password", () => {
    assert.throws(
      () => requireAdminSeedPassword(undefined),
      /ADMIN_PASSWORD must be set before creating the admin user/,
    );
  });

  it("rejects a blank password", () => {
    assert.throws(
      () => requireAdminSeedPassword("   "),
      /ADMIN_PASSWORD must be set before creating the admin user/,
    );
  });

  it("trims a configured password without changing its value", () => {
    assert.equal(requireAdminSeedPassword("  current-admin-secret  "), "current-admin-secret");
  });
});
