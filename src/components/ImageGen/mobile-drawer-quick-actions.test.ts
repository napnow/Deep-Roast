import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("mobile drawer exposes check-in and chat-history quick actions", () => {
  const drawer = readFileSync(
    "src/components/ImageGen/MobileDrawer.tsx",
    "utf8",
  );
  const home = readFileSync("src/app/page.tsx", "utf8");

  assert.match(drawer, /getMobileCheckinCard/);
  assert.match(drawer, /mobile-checkin-card/);
  assert.match(drawer, /onCheckin/);
  assert.match(drawer, /会话记录/);
  assert.match(drawer, /onOpenChatHistory/);
  assert.match(home, /onOpenChatHistory/);
});

test("mobile drawer exposes API key management to authenticated users", () => {
  const drawer = readFileSync(
    "src/components/ImageGen/MobileDrawer.tsx",
    "utf8",
  );

  assert.match(drawer, /key: "api-keys"/);
  assert.match(drawer, /label: "API 接入"/);
  assert.match(drawer, /创建、复制和管理你的 API Key/);
  assert.match(drawer, /onOpenApiKeys/);
});

test("mobile drawer exposes logout and reuses the authenticated logout flow", () => {
  const drawer = readFileSync(
    "src/components/ImageGen/MobileDrawer.tsx",
    "utf8",
  );
  const home = readFileSync("src/app/page.tsx", "utf8");

  assert.match(drawer, /onLogout: \(\) => void/);
  assert.match(drawer, /onClick=\{handleLogout\}/);
  assert.match(drawer, /onLogout\(\)/);
  assert.match(home, /onLogout=\{logout\}/);
});

test("mobile drawer leaves primary workspaces to the persistent navigation", () => {
  const drawer = readFileSync(
    "src/components/ImageGen/MobileDrawer.tsx",
    "utf8",
  );
  const home = readFileSync("src/app/page.tsx", "utf8");

  assert.doesNotMatch(drawer, /label: "文生图"/);
  assert.doesNotMatch(drawer, /label: "图库"/);
  assert.doesNotMatch(drawer, /label: "对话"/);
  assert.match(home, /MobileWorkspaceNav/);
});

test("mobile drawer exposes model configuration and console only to admins", () => {
  const drawer = readFileSync(
    "src/components/ImageGen/MobileDrawer.tsx",
    "utf8",
  );
  const home = readFileSync("src/app/page.tsx", "utf8");

  assert.match(drawer, /role === "admin"/);
  assert.match(drawer, /label: "模型配置"/);
  assert.match(drawer, /label: "管理控制台"/);
  assert.match(drawer, /onOpenSettings/);
  assert.match(drawer, /onOpenAdmin/);
  assert.match(home, /onOpenSettings=\{\(\) => setSettingsOpen\(true\)\}/);
  assert.match(home, /onOpenAdmin=/);
});
