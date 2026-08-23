import assert from "node:assert/strict";
import { test } from "node:test";
import config from "../../next.config";

test("production security headers are configured without CSP", async () => {
  assert.equal(config.poweredByHeader, false);
  assert.equal(config.experimental?.proxyClientMaxBodySize, "30mb");
  assert.ok(config.headers);

  const rules = await config.headers();
  const wildcard = rules.find((rule) => rule.source === "/:path*");
  assert.ok(wildcard);
  const headers = new Map(wildcard.headers.map(({ key, value }) => [key, value]));

  assert.equal(
    headers.get("Strict-Transport-Security"),
    "max-age=31536000; includeSubDomains",
  );
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(
    headers.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(
    headers.get("Permissions-Policy"),
    "camera=(), microphone=(), geolocation=()",
  );
  assert.equal(headers.has("Content-Security-Policy"), false);
});
