import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("home exposes persistent mobile workspace navigation", () => {
  const source = readFileSync("src/app/page.tsx", "utf8");
  assert.match(source, /MobileWorkspaceNav/);
  assert.match(source, /handleSelectMobileWorkspace/);
  assert.match(source, /mobileWorkspaceTitle/);
  assert.match(source, /onOpenWallet=\{\(\) => setWalletOpen\(true\)\}/);
  assert.match(source, /onOpenPassword=\{\(\) => setPwOpen\(true\)\}/);
  assert.match(source, /onOpenApiKeys=\{\(\) => setApiOpen\(true\)\}/);
  assert.match(source, /onOpenDonation=\{\(\) => setDonationOpen\(true\)\}/);
});

test("desktop chat menu continues to open the existing chat sidebar", () => {
  const source = readFileSync("src/app/page.tsx", "utf8");
  assert.match(
    source,
    /window\.matchMedia\("\(min-width: 768px\)"\)\.matches/,
  );
  assert.match(
    source,
    /isDesktop && activeMode === "chat"[\s\S]*setChatSidebarOpen\(true\);/,
  );
});

test("mobile workspace shell keeps four equal touch targets", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const header = readFileSync("src/components/Header.tsx", "utf8");
  const nav = readFileSync(
    "src/components/Workspace/MobileWorkspaceNav.tsx",
    "utf8",
  );
  const drawer = readFileSync(
    "src/components/ImageGen/MobileDrawer.tsx",
    "utf8",
  );
  assert.match(css, /\.mobile-workspace-nav/);
  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(
    css,
    /\.mobile-workspace-nav\s*\{\s*width: 100vw;\s*max-width: 100vw;/,
  );
  assert.match(header, /mobile-app-header/);
  assert.match(nav, /AppIcon/);
  assert.match(nav, /gallery:\s*"history"/);
  assert.match(drawer, /label:\s*"积分与邀请"/);
  assert.match(drawer, /label:\s*"修改密码"/);
  assert.match(drawer, /label:\s*"打赏支持"/);
  assert.match(drawer, /onOpenWallet\(\)/);
  assert.match(drawer, /onOpenPassword\(\)/);
  assert.match(drawer, /onOpenDonation\(\)/);
  assert.match(
    css,
    /\.mobile-app-header\s*\{\s*position: relative;\s*display: none;/,
  );
  assert.match(
    css,
    /@media \(max-width: 47\.999rem\)\s*\{\s*\.mobile-app-header\s*\{\s*display: grid;/,
  );
  assert.match(
    css,
    /@media \(min-width: 48rem\)\s*\{\s*\.mobile-app-header\s*\{\s*display: none !important;/,
  );
});

test("mobile keyboard state hides only the mobile navigation", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  const nav = readFileSync(
    "src/components/Workspace/MobileWorkspaceNav.tsx",
    "utf8",
  );

  assert.match(page, /useMobileViewport/);
  assert.match(page, /hidden=\{mobileViewport\.keyboardOpen\}/);
  assert.match(nav, /hidden\?: boolean/);
  assert.match(nav, /if \(hidden\) return null/);
});

test("mobile workspace keeps scrolling inside the result canvas", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  assert.match(
    css,
    /@media \(max-width: 767px\)\s*\{\s*\.workspace-shell\s*\{[\s\S]*height: 100dvh/,
  );
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*\.workspace-shell\s*\{[\s\S]*overflow: hidden/,
  );
  assert.match(css, /\.result-canvas\s*\{[\s\S]*overscroll-behavior: contain/);
  assert.match(css, /\.result-canvas\s*\{[\s\S]*-webkit-overflow-scrolling: touch/);
});
