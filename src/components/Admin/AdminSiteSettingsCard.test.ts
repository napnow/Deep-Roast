import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("admin site settings exposes the registration IP limit toggle", () => {
  const source = readFileSync(
    "src/components/Admin/AdminSiteSettingsCard.tsx",
    "utf8",
  );
  assert.match(source, /registrationIpLimitEnabled/);
  assert.match(source, /同 IP 注册限制/);
  assert.match(source, /限制中/);
  assert.match(source, /已关闭/);
});
