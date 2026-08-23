import assert from "node:assert/strict";
import { test } from "node:test";
import { getClientIp } from "./rate-limit";

test("ignores spoofable Cloudflare and forwarded headers without canonical identity", () => {
  const req = new Request("https://example.test", {
    headers: {
      "cf-connecting-ip": "203.0.113.24",
      "x-forwarded-for": "172.68.22.77",
      "x-real-ip": "172.68.22.77",
    },
  });

  assert.equal(getClientIp(req), "172.68.22.77");
});

test("ignores forwarded chains when the canonical header is absent", () => {
  const req = new Request("https://example.test", {
    headers: {
      "x-forwarded-for": "198.51.100.10, 10.0.0.2",
    },
  });

  assert.equal(getClientIp(req), "unknown");
});

test("falls back to x-real-ip and then unknown", () => {
  const realIp = new Request("https://example.test", {
    headers: { "x-real-ip": "198.51.100.11" },
  });
  const unknown = new Request("https://example.test");

  assert.equal(getClientIp(realIp), "198.51.100.11");
  assert.equal(getClientIp(unknown), "unknown");
});
