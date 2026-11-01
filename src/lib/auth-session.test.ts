import { test } from "node:test";
import assert from "node:assert/strict";
import { signToken, verifyToken, sessionMatchesPassword } from "./auth";

test("sessions bind to the current password hash and user identity", async () => {
  const token = await signToken({ userId: "user-1", username: "alice", role: "user" }, "old-hash");
  const payload = await verifyToken(token);
  assert.ok(payload);
  assert.equal(sessionMatchesPassword(payload, "old-hash"), true);
  assert.equal(sessionMatchesPassword(payload, "new-hash"), false);
  assert.equal(sessionMatchesPassword({ ...payload, userId: "user-2" }, "old-hash"), false);
  assert.equal(sessionMatchesPassword({ userId: "user-1", username: "alice", role: "user" }, "old-hash"), false);
  const encodedPayload = token.split(".")[1];
  assert.ok(!Buffer.from(encodedPayload, "base64url").toString().includes("old-hash"));
});
