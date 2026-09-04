import assert from "node:assert/strict";
import { test } from "node:test";
import { checkinStatusFromUser } from "./credits";

test("check-in status exposes the configured reward", () => {
  const status = checkinStatusFromUser(
    { role: "user", lastCheckinOn: null },
    75,
  );

  assert.equal(status.reward, 75);
});
