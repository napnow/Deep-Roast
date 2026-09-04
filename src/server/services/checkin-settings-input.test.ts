import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "@/server/http";
import {
  parseCheckinReward,
  parseCheckinSettingsPatch,
} from "./checkin-settings-input";

test("parses a non-negative integer check-in reward", () => {
  assert.equal(parseCheckinReward("75"), 75);
  assert.equal(parseCheckinReward(0), 0);
});

test("rejects invalid check-in rewards", () => {
  for (const value of ["", "1.5", -1, 2_147_483_648, "abc"]) {
    assert.throws(
      () => parseCheckinReward(value),
      (error: unknown) =>
        error instanceof ApiError && error.status === 400,
    );
  }
});

test("builds a check-in settings patch without applying it", () => {
  assert.deepEqual(
    parseCheckinSettingsPatch({ checkinReward: "120" }),
    { checkinReward: 120 },
  );
});
