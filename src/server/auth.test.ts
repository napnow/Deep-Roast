import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import { assertAdminRole, resolveUserFromRequest } from "./auth";
import { signToken } from "@/lib/auth";
import { db } from "@/db";
import { SignJWT } from "jose";

describe("admin authorization", () => {
  it("rejects ordinary users", () => {
    assert.throws(
      () => assertAdminRole("user"),
      (error: unknown) => error instanceof ApiError && error.status === 403,
    );
  });

  it("accepts admins", () => assert.doesNotThrow(() => assertAdminRole("admin")));
});

it("rejects an existing cookie immediately after the stored password hash changes", async () => {
  let password = "old-hash";
  const select = mock.method(db, "select", (() => ({
    from: () => ({ where: () => ({ limit: async () => [{ password }] }) }),
  })) as unknown as typeof db.select);
  try {
    const token = await signToken({ userId: "user-1", username: "alice", role: "user" }, password);
    const request = new Request("https://example.test", { headers: { cookie: `token=${token}` } });
    assert.equal((await resolveUserFromRequest(request))?.userId, "user-1");
    password = "new-hash";
    assert.equal(await resolveUserFromRequest(request), null);
    const newToken = await signToken({ userId: "user-1", username: "alice", role: "user" }, password);
    const newRequest = new Request("https://example.test", { headers: { cookie: `token=${newToken}` } });
    assert.equal((await resolveUserFromRequest(newRequest))?.userId, "user-1");
    const oldSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-session-signing-secret";
    try {
      const legacy = await new SignJWT({ userId: "user-1", username: "alice", role: "user" })
        .setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d")
        .sign(new TextEncoder().encode(process.env.JWT_SECRET));
      const legacyRequest = new Request("https://example.test", { headers: { cookie: `token=${legacy}` } });
      assert.equal(await resolveUserFromRequest(legacyRequest), null);
    } finally {
      if (oldSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = oldSecret;
    }
  } finally {
    select.mock.restore();
  }
});
