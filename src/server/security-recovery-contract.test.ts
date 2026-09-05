import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("recovered runtime keeps encrypted config, private images, and secure seeding", async () => {
  const [config, middleware, seed] = await Promise.all([
    source("src/lib/config.ts"),
    source("src/middleware.ts"),
    source("src/db/seed.ts"),
  ]);

  assert.match(config, /resolveLlmConfigKey\(config\)/);
  assert.match(middleware, /\/images\/:path\*/);
  assert.match(middleware, /pathname\.startsWith\("\/images\/"\)/);
  assert.match(seed, /requireAdminSeedPassword\(process\.env\.ADMIN_PASSWORD\)/);
  assert.doesNotMatch(seed, /ADMIN_PASSWORD\s*\|\|\s*["']admin123["']/);
});

test("configured channels remain authoritative even with no default models", async () => {
  const route = await source("src/app/api/config/route.ts");
  assert.match(route, /channelConfigurationExists\s*\?\s*channelTextModels/);
  assert.match(route, /channelConfigurationExists\s*\?\s*channelImageModels/);
});

test("all billable routes and browser callers retain durable idempotency", async () => {
  const routePaths = [
    "src/app/api/chat/route.ts",
    "src/app/api/image/route.ts",
    "src/app/api/image-edit/route.ts",
    "src/app/api/image-edit/batch/route.ts",
    "src/app/api/v1/images/generations/route.ts",
  ];
  for (const path of routePaths) {
    const text = await source(path);
    assert.match(text, /beginRequest\(/, path);
    assert.match(text, /readIdempotencyKey\(/, path);
  }

  const [chatActions, imageActions] = await Promise.all([
    source("src/hooks/useChatActions.ts"),
    source("src/hooks/useImageActions.ts"),
  ]);
  assert.match(chatActions, /["']Idempotency-Key["']/);
  assert.match(imageActions, /["']Idempotency-Key["']/);
});

test("chat image cancellation reaches the upstream and replays an SSE transcript", async () => {
  const [chat, image, actions] = await Promise.all([
    source("src/server/services/chat.ts"),
    source("src/server/services/image.ts"),
    source("src/hooks/useChatActions.ts"),
  ]);
  assert.match(chat, /AbortSignal\.any/);
  assert.match(chat, /signal:\s*operationSignal/);
  assert.match(chat, /operationController\.abort\(\)/);
  assert.match(image, /signal\?:\s*AbortSignal/);
  assert.match(actions, /CHAT_REQUEST_TIMEOUT_MS\s*=\s*310_000/);
  assert.match(chat, /requestLeaseToken/);
  assert.match(chat, /completeRequest\(/);
});

test("v1 idempotent image replay stores keys and mints fresh access tokens", async () => {
  const route = await source("src/app/api/v1/images/generations/route.ts");
  assert.match(route, /images:\s*results\.map/);
  assert.match(route, /renderStoredImageResponse\(claim\.body/);
  assert.match(route, /createImageAccessToken\(result\.storageKey, userId\)/);
});

test("idempotency finalization is fenced by a unique lease token", async () => {
  const store = await source(
    "src/server/services/request-idempotency-store.ts",
  );
  assert.match(store, /leaseToken:\s*string/);
  assert.match(store, /eq\(requestIdempotency\.leaseToken, leaseToken\)/);
  assert.match(store, /IDEMPOTENCY_STALE_REQUEST/);
  assert.doesNotMatch(store, /return \{ kind: "new", id: claimed\.id/);
});

test("explicitly empty model lists remain unavailable in the client", async () => {
  const [initialData, imageActions, page] = await Promise.all([
    source("src/hooks/useInitialData.ts"),
    source("src/hooks/useImageActions.ts"),
    source("src/app/page.tsx"),
  ]);
  assert.match(initialData, /cfg\.enabledImageModels \?\?/);
  assert.match(imageActions, /MODEL_UNAVAILABLE/);
  assert.match(page, /textModelAvailable/);
});

test("public routes keep bounded bodies and signed private image URLs", async () => {
  const [login, register, edit, batch, gateway] = await Promise.all([
    source("src/app/api/auth/login/route.ts"),
    source("src/app/api/auth/register/route.ts"),
    source("src/app/api/image-edit/route.ts"),
    source("src/app/api/image-edit/batch/route.ts"),
    source("src/app/api/v1/images/generations/route.ts"),
  ]);
  assert.match(login, /readJson/);
  assert.match(register, /readJson/);
  assert.match(edit, /IMAGE_EDIT_JSON_MAX_BYTES/);
  assert.match(batch, /IMAGE_EDIT_JSON_MAX_BYTES/);
  assert.match(gateway, /createImageAccessToken/);
});

test("restored schema and chat-image feature are wired into production paths", async () => {
  const [migration, chat] = await Promise.all([
    source("drizzle/0021_model_channels.sql"),
    source("src/server/services/chat.ts"),
  ]);
  assert.match(migration, /assistant_image_prompt/);
  assert.match(chat, /detectAssistantAppearanceIntent/);
  assert.match(chat, /createAssistantImageMessage/);
  assert.match(chat, /image_started/);
});

test("channel writes and registration policy decisions stay transactional", async () => {
  const [configRoute, registerRoute] = await Promise.all([
    source("src/app/api/config/route.ts"),
    source("src/app/api/auth/register/route.ts"),
  ]);
  assert.match(configRoute, /db\.transaction\(async \(tx\)/);
  assert.match(configRoute, /replaceModelChannels\(channelPayload, tx\)/);
  const transactionStart = registerRoute.indexOf("db.transaction(async (tx)");
  const settingRead = registerRoute.indexOf("registrationIpLimitEnabled", transactionStart);
  const recordInsert = registerRoute.indexOf("tx.insert(registrationRecords)", transactionStart);
  assert.ok(transactionStart >= 0 && settingRead > transactionStart);
  assert.ok(recordInsert > settingRead);
});

test("configured-channel POST requests use the DNS-pinned transport", async () => {
  for (const path of [
    "src/server/services/chat.ts",
    "src/server/services/image.ts",
    "src/server/services/reverse-prompt.ts",
  ]) {
    const text = await source(path);
    assert.match(text, /enforcePublicHttps/);
    assert.match(text, /requestPublicHttpsResponse/);
  }
});
