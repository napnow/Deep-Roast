import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addApiV1CorsHeaders,
  apiV1CorsPreflight,
} from "./http";

describe("API v1 CORS", () => {
  it("adds browser CORS headers to normal and error responses", () => {
    const response = addApiV1CorsHeaders(
      new Response(JSON.stringify({ error: "bad" }), { status: 400 }),
    );
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    assert.equal(
      response.headers.get("Access-Control-Allow-Headers"),
      "Authorization, Content-Type, Idempotency-Key",
    );
    assert.equal(response.status, 400);
  });

  it("returns a successful preflight response", () => {
    const response = apiV1CorsPreflight();
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    assert.equal(
      response.headers.get("Access-Control-Allow-Methods"),
      "GET, POST, OPTIONS",
    );
  });
});
