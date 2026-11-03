import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("registration applies cleanup risk marks inside the transaction", async () => {
  const register = await source("src/app/api/auth/register/route.ts");

  const transactionStart = register.indexOf("db.transaction(async (tx)");
  assert.ok(transactionStart >= 0, "register route must run in a transaction");

  const riskRead = register.indexOf(
    "from(registrationRiskMarks)",
    transactionStart,
  );
  const userInsert = register.indexOf(".insert(users)", transactionStart);
  assert.ok(riskRead > transactionStart, "risk mark must be read in the tx");
  assert.ok(userInsert > riskRead, "risk read must happen before user insert");

  assert.match(register, /resolveRegistrationBenefits\(/);
  assert.match(register, /restrictedUntil:\s*benefits\.restrictedUntil/);
  assert.match(
    register,
    /if\s*\(!benefits\.restricted && inviteCode && invitationEnabled\)/,
  );
  assert.match(register, /resolveRestrictedInviterReward\(/);
  assert.match(register, /inviter\.restrictedUntil/);
  assert.match(register, /benefitsRestricted:\s*benefits\.restricted/);
  assert.match(register, /benefitsRestricted:\s*user\.benefitsRestricted/);
});

test("check-in reward honors the per-user restriction window", async () => {
  const [credits, checkinRoute, meRoute] = await Promise.all([
    source("src/server/services/credits.ts"),
    source("src/app/api/credits/checkin/route.ts"),
    source("src/app/api/auth/me/route.ts"),
  ]);

  assert.match(credits, /resolveCheckinReward\(/);
  assert.match(credits, /user\.restrictedUntil/);
  assert.match(checkinRoute, /resolveCheckinReward\(/);
  assert.match(meRoute, /resolveCheckinReward\(/);
  assert.match(meRoute, /restrictedUntil: users\.restrictedUntil/);
});

test("admin site settings route and env template expose the new policy", async () => {
  const [route, envExample] = await Promise.all([
    source("src/app/api/admin/site-settings/route.ts"),
    source(".env.example"),
  ]);

  assert.match(route, /parseRepeatRegistrationSettingsPatch\(body\)/);
  assert.match(route, /updateRepeatRegistrationSettings\(repeatRegistrationPatch\)/);
  assert.match(envExample, /REGISTRATION_RISK_HASH_SECRET=/);
});

test("registration and cleanup serialize and preserve IP hashes independently of the IP limit", async () => {
  const [register, cleanup, schema] = await Promise.all([
    source("src/app/api/auth/register/route.ts"),
    source("src/server/services/stale-user-cleanup.ts"),
    source("src/db/schema.ts"),
  ]);
  assert.match(register, /lockRegistrationCleanup\(tx\)/);
  assert.match(cleanup, /lockRegistrationCleanup\(tx\)/);
  assert.match(register, /registrationIpHash:\s*ipHash/);
  assert.match(cleanup, /users\.registrationIpHash/);
  assert.match(schema, /registrationIpHash:\s*text/);
});
