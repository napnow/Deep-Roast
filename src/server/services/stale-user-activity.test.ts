import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLastActivityAt,
  isStaleUser,
  type ActivityTimestamps,
} from "./stale-user-activity";

const baseline: ActivityTimestamps = {
  createdAt: "2026-09-01T00:00:00.000Z",
  lastLoginAt: null,
  latestConversationAt: null,
  latestImageAt: null,
};

describe("stale user activity", () => {
  it("uses exact persisted check-in, consumption, and API-use timestamps", () => {
    const cutoff = new Date("2026-09-10T12:00:00.000Z");
    for (const evidence of [
      { latestCheckinAt: "2026-09-12T01:00:00.000Z" },
      { latestConsumeAt: "2026-09-12T02:00:00.000Z" },
      { latestApiUseAt: "2026-09-12T03:00:00.000Z" },
    ]) {
      assert.equal(isStaleUser({ ...baseline, ...evidence }, cutoff), false);
    }
  });

  it("treats a legacy Shanghai check-in date as active through that local day", () => {
    const activity = getLastActivityAt({
      ...baseline,
      lastCheckinOn: "2026-09-12",
    });

    assert.equal(activity.toISOString(), "2026-09-12T15:59:59.999Z");
  });

  it("prefers an exact check-in transaction over the legacy day fallback", () => {
    const activity = getLastActivityAt({
      ...baseline,
      lastCheckinOn: "2026-09-12",
      latestCheckinAt: "2026-09-12T01:23:45.000Z",
    });

    assert.equal(activity.toISOString(), "2026-09-12T01:23:45.000Z");
  });

  it("uses a newer legacy check-in day when exact history is older", () => {
    const activity = getLastActivityAt({
      ...baseline,
      lastCheckinOn: "2026-09-12",
      latestCheckinAt: "2026-09-11T10:00:00.000Z",
    });

    assert.equal(activity.toISOString(), "2026-09-12T15:59:59.999Z");
  });

  it("ignores malformed legacy check-in dates", () => {
    assert.equal(
      getLastActivityAt({ ...baseline, lastCheckinOn: "not-a-day" }).toISOString(),
      "2026-09-01T00:00:00.000Z",
    );
  });
});
