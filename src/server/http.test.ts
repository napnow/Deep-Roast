import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it, mock } from "node:test";
import { ApiError, handleRoute, jsonError, readJson } from "./http";

describe("HTTP safety", () => {
  it("does not expose unknown exception messages", async () => {
    const errorLog = mock.method(console, "error", () => undefined);
    try {
      const response = jsonError(new Error("postgres password in stack"));
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: "服务器错误" });
    } finally {
      errorLog.mock.restore();
    }
  });

  it("rejects a body larger than the configured byte limit", async () => {
    const req = new Request("https://app.test/api", {
      method: "POST",
      body: JSON.stringify({ value: "1234567890" }),
    });
    await assert.rejects(
      () => readJson(req, { maxBytes: 8 }),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 413 &&
        error.code === "PAYLOAD_TOO_LARGE",
    );
  });

  it("keeps reviewed ApiError messages", async () => {
    const response = jsonError(new ApiError("参数错误", 400, "BAD_INPUT"));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "参数错误",
      code: "BAD_INPUT",
    });
  });

  it("keeps API v1 CORS headers on sanitized errors", async () => {
    const errorLog = mock.method(console, "error", () => undefined);
    const route = handleRoute(async () => {
      throw new Error("internal detail");
    });

    try {
      const response = await route(
        new Request("https://app.test/api/v1/models"),
        undefined,
      );

      assert.equal(response.status, 500);
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
      assert.equal(
        response.headers.get("Access-Control-Allow-Headers"),
        "Authorization, Content-Type",
      );
      assert.deepEqual(await response.json(), { error: "服务器错误" });
    } finally {
      errorLog.mock.restore();
    }
  });

  it("cancels a declared oversized body before returning 413", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
      },
      cancel() {
        cancelled = true;
      },
    });
    const req = new Request("https://app.test/api", {
      method: "POST",
      body,
      headers: { "content-length": "999999" },
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await assert.rejects(
      () => readJson(req, { maxBytes: 8 }),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 413 &&
        error.code === "PAYLOAD_TOO_LARGE",
    );
    await Promise.resolve();
    assert.equal(cancelled, true);
  });

  it("keeps payload-too-large when stream cancellation rejects", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]));
      },
      cancel() {
        return Promise.reject(new Error("cancel failed"));
      },
    });
    const req = new Request("https://app.test/api", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await assert.rejects(
      () => readJson(req, { maxBytes: 3 }),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 413 &&
        error.code === "PAYLOAD_TOO_LARGE",
    );
  });

  it("uses bounded JSON reads for the remaining public auth routes", () => {
    for (const file of [
      "src/app/api/auth/login/route.ts",
      "src/app/api/auth/register/route.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      assert.match(source, /readJson/);
      assert.doesNotMatch(source, /await\s+req\.json\(\)/);
    }
  });
});
