import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const secretRoute = "src/app/api/user/api-keys/[id]/secret/route.ts";
const rotateRoute = "src/app/api/user/api-keys/[id]/rotate/route.ts";
const adminRoute = "src/app/api/admin/users/[id]/api-keys/route.ts";
const servicePath = "src/server/services/api-keys.ts";
const adminUiPath = "src/components/Admin/AdminApiKeysTab.tsx";

test("owner secret and rotation routes enforce authentication and no-store", () => {
  assert.equal(existsSync(secretRoute), true, "secret route should exist");
  assert.equal(existsSync(rotateRoute), true, "rotate route should exist");

  const secret = readFileSync(secretRoute, "utf8");
  const rotate = readFileSync(rotateRoute, "utf8");
  assert.match(secret, /requireActiveUser\(req\)/);
  assert.match(secret, /getApiKeySecret\(user\.userId, id\)/);
  assert.match(secret, /privateNoStore\(await secretHandler\(req, context\)\)/);
  assert.match(rotate, /requireActiveUser\(req\)/);
  assert.match(rotate, /enforceRateLimit\("api-key-rotate", user\.userId, 10, 60 \* 60\)/);
  assert.match(rotate, /rotateApiKey\(user\.userId, id\)/);
  assert.match(rotate, /privateNoStore\(await rotateHandler\(req, context\)\)/);
});

test("admin API key routes cannot recover plaintext", () => {
  const admin = readFileSync(adminRoute, "utf8");
  const service = readFileSync(servicePath, "utf8");
  const adminUi = readFileSync(adminUiPath, "utf8");
  assert.doesNotMatch(admin, /getApiKeySecret|decryptApiKey/);
  assert.match(service, /return \{ record: result\.record \}/);
  assert.doesNotMatch(adminUi, /plainKey|canDismissCreatedKey/);
});
