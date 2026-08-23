import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ApiError } from "../http";
import { resolveCatalogEndpoint } from "./models";

test("custom catalog URLs require an explicit API key", () => {
  assert.throws(
    () =>
      resolveCatalogEndpoint(
        { baseUrl: "https://attacker.example/v1", apiKey: "" },
        {
          baseUrl: "http://127.0.0.1:5661/v1",
          arkApiKey: "server-secret",
        },
      ),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
});

test("custom catalog URLs use only the explicitly supplied API key", () => {
  assert.deepEqual(
    resolveCatalogEndpoint(
      { baseUrl: "https://catalog.example/v1", apiKey: " explicit " },
      {
        baseUrl: "http://127.0.0.1:5661/v1",
        arkApiKey: "server-secret",
      },
    ),
    {
      baseUrl: "https://catalog.example/v1",
      apiKey: "explicit",
      custom: true,
    },
  );
});

test("custom catalog URLs must be public HTTPS targets", () => {
  assert.throws(
    () =>
      resolveCatalogEndpoint(
        { baseUrl: "http://127.0.0.1:5661/v1", apiKey: "explicit" },
        null,
      ),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
});

test("saved catalog configuration keeps local HTTP compatibility", () => {
  assert.deepEqual(
    resolveCatalogEndpoint(
      {},
      {
        baseUrl: "http://127.0.0.1:5661/v1",
        arkApiKey: " server-secret ",
      },
    ),
    {
      baseUrl: "http://127.0.0.1:5661/v1",
      apiKey: "server-secret",
      custom: false,
    },
  );
});

test("POST model catalog route requires an administrator", () => {
  const source = readFileSync("src/app/api/models/route.ts", "utf8");
  const postSource = source.slice(source.indexOf("export const POST"));

  assert.match(source, /import\s+\{\s*requireActiveUser,\s*requireAdmin\s*\}/);
  assert.match(postSource, /await requireAdmin\(req\)/);
  assert.doesNotMatch(postSource, /requireActiveUser\(req\)/);
});

test("model catalog failures do not log raw upstream error objects", () => {
  const source = readFileSync("src/server/services/models.ts", "utf8");

  assert.doesNotMatch(
    source,
    /console\.warn\("获取模型目录异常",\s*err\)/,
  );
  assert.doesNotMatch(source, /errText|await\s+\w+\.text\(\)/);
});
