import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, siteSettings, registrationRiskMarks } from "@/db/schema";
import { hashRegistrationIp } from "./registration-risk";
import { cleanupStaleUsers } from "./stale-user-cleanup";
import { lockRegistrationCleanup } from "./registration-cleanup-lock";

const enabled = process.env.IP_RISK_DISPOSABLE_TEST === "yes-local-disposable";

test("cleanup preserves a registration hash without an IP limit record", { skip: !enabled }, async () => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/deep_roast_bootstrap_test");
  const ipHash = hashRegistrationIp("203.0.113.12", process.env.JWT_SECRET!);
  await db.insert(siteSettings).values({ id: 1, registrationIpLimitEnabled: 0 }).onConflictDoUpdate({ target: siteSettings.id, set: { registrationIpLimitEnabled: 0 } });
  await db.insert(users).values({ username: "risk_fixture", password: "fixture", registrationIpHash: ipHash, createdAt: new Date("2020-01-01") });
  const result = await cleanupStaleUsers(new Date("2026-11-03"));
  assert.ok(result.users.includes("risk_fixture"));
  const [mark] = await db.select().from(registrationRiskMarks).where(eq(registrationRiskMarks.ipHash, ipHash));
  assert.ok(mark);
  assert.equal(mark.restrictedUntil.toISOString(), "2026-12-03T00:00:00.000Z");
});

test("registration waits for the cleanup transaction lock", { skip: !enabled }, async () => {
  let release!: () => void;
  let acquired!: () => void;
  const locked = new Promise<void>((resolve) => { acquired = resolve; });
  const proceed = new Promise<void>((resolve) => { release = resolve; });
  const first = db.transaction(async (tx) => { await lockRegistrationCleanup(tx); acquired(); await proceed; });
  await locked;
  let secondAcquired = false;
  const second = db.transaction(async (tx) => { await lockRegistrationCleanup(tx); secondAcquired = true; });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(secondAcquired, false);
  release();
  await Promise.all([first, second]);
  assert.equal(secondAcquired, true);
});
