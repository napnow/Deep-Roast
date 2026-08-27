# Mobile API Key Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an API access entry to the authenticated mobile account drawer so users can open the existing API key creation and management modal.

**Architecture:** Extend `MobileDrawer` with one callback and menu item, then connect that callback to the existing Zustand `setApiOpen(true)` action in the home page. Reuse the current modal, routes, encryption, validation, and error states without changing the database or backend.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript, Zustand, Node test runner.

## Global Constraints

- Read the relevant guides under `node_modules/next/dist/docs/` before editing Next.js code.
- All logged-in users can see the entry; it is not admin-only.
- Do not add routes, database fields, migrations, or a second API key UI.
- Preserve all unrelated local working-tree changes and commit only files changed for this feature.
- Deploy only the minimal two-file production source change to a new server release.

---

### Task 1: Connect the mobile account drawer to the existing API key modal

**Files:**
- Modify: `src/components/ImageGen/mobile-drawer-quick-actions.test.ts`
- Modify: `src/app/mobile-workspace-navigation.test.ts`
- Modify: `src/components/ImageGen/MobileDrawer.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: existing Zustand action `setApiOpen(open: boolean)` and existing `ApiKeysModal` rendered by `AppModals`.
- Produces: `MobileDrawerProps.onOpenApiKeys: () => void` and a mobile menu item with key `api-keys`.

- [ ] **Step 1: Add failing mobile-entry tests**

Add these assertions to `src/components/ImageGen/mobile-drawer-quick-actions.test.ts`:

```ts
assert.match(drawer, /key: "api-keys"/);
assert.match(drawer, /label: "API 接入"/);
assert.match(drawer, /创建、复制和管理你的 API Key/);
assert.match(drawer, /onOpenApiKeys/);
```

Add these assertions to `src/app/mobile-workspace-navigation.test.ts`:

```ts
assert.match(source, /onOpenApiKeys=\{\(\) => setApiOpen\(true\)\}/);
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run:

```bash
npx tsx --test src/components/ImageGen/mobile-drawer-quick-actions.test.ts src/app/mobile-workspace-navigation.test.ts
```

Expected: failure because `MobileDrawer` does not expose `onOpenApiKeys` and the home page does not pass it.

- [ ] **Step 3: Implement the smallest UI connection**

In `src/components/ImageGen/MobileDrawer.tsx`, add the prop:

```ts
/** 打开既有 API Key 创建与管理弹窗 */
onOpenApiKeys: () => void;
```

Add `api-keys` to the menu key union and insert this item after password:

```ts
{
  key: "api-keys",
  label: "API 接入",
  icon: "details",
  desc: "创建、复制和管理你的 API Key",
},
```

Handle the item after closing the drawer:

```ts
if (key === "api-keys") {
  onOpenApiKeys();
  return;
}
```

In `src/app/page.tsx`, connect the existing store action:

```tsx
onOpenApiKeys={() => setApiOpen(true)}
```

- [ ] **Step 4: Run targeted and existing API key tests**

Run:

```bash
npx tsx --test src/components/ImageGen/mobile-drawer-quick-actions.test.ts src/app/mobile-workspace-navigation.test.ts src/components/ApiKeysModal.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run project verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: tests, lint, and the Next.js production build pass.

- [ ] **Step 6: Commit only feature files**

```bash
git add src/components/ImageGen/mobile-drawer-quick-actions.test.ts src/app/mobile-workspace-navigation.test.ts src/components/ImageGen/MobileDrawer.tsx src/app/page.tsx
git commit -m "feat: add mobile api key entry"
```

---

### Task 2: Deploy the minimal change to the server

**Files:**
- Deploy: `src/components/ImageGen/MobileDrawer.tsx`
- Deploy: `src/app/page.tsx`
- Create on server: `/opt/deeproast-releases/20260827-mobile-api-key-entry`

**Interfaces:**
- Consumes: current `/opt/deeproast-current` release and its existing dependencies and environment configuration.
- Produces: a new tested release selected by `/opt/deeproast-current`.

- [ ] **Step 1: Reconfirm source parity and active release**

Compare SHA-256 hashes for both production source files and confirm `readlink -f /opt/deeproast-current` still resolves to `20260824-model-channels-final`.

- [ ] **Step 2: Create a recoverable release copy**

Create `/opt/deeproast-releases/20260827-mobile-api-key-entry` from the current release without modifying the active directory.

- [ ] **Step 3: Transfer only the two changed production files**

Copy the local `MobileDrawer.tsx` and `page.tsx` into the corresponding paths in the new release.

- [ ] **Step 4: Build before switching traffic**

Run `npm run build` in the new release. Expected: exit code 0.

- [ ] **Step 5: Atomically switch and restart**

Point `/opt/deeproast-current` at the new release, restart `deeproast.service`, and retain the previous release for rollback.

- [ ] **Step 6: Verify production health**

Confirm the service is active, port 3000 returns HTTP 200, and the current symlink resolves to the new release.
