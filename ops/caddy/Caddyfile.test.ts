import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Caddy rebuilds one canonical client identity for every reverse proxy", () => {
  const source = readFileSync("ops/caddy/Caddyfile", "utf8");
  const blocks = [...source.matchAll(/reverse_proxy [^\n{]+\s*\{([\s\S]*?)\n\s*\}/g)];
  assert.equal(blocks.length, 3);
  for (const [, block] of blocks) {
    assert.match(block, /import deeproast-client-ip/);
  }
  const start = source.indexOf("(deeproast-client-ip)");
  const end = source.indexOf("\n}", start);
  const snippet = source.slice(start, end);
  assert.match(snippet, /header_up -CF-Connecting-IP/);
  assert.match(snippet, /header_up -X-Forwarded-For/);
  assert.match(snippet, /header_up -X-Real-IP/);
  assert.match(snippet, /header_up X-Real-IP \{http.request.client_ip\}/);
  assert.match(snippet, /header_up X-Forwarded-For \{http.request.client_ip\}/);
});
