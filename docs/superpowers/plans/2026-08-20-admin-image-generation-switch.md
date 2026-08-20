# Admin Image Generation Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global admin-controlled image-generation switch that blocks ordinary users across web and API-key image endpoints while preserving admin image generation and reverse-prompt analysis.

**Architecture:** Persist one enabled-by-default flag in the single-row `site_settings` table. Put the authoritative role-aware guard in the shared image service before validation, credit reservation, or upstream calls, while exposing the flag through authenticated config for immediate frontend feedback. The admin site-settings card updates the flag; the creation UI disables text-to-image and image-to-image only for non-admin users.

**Tech Stack:** Next.js 16.2.10 App Router route handlers, React 19 client components, Zustand 5, Drizzle ORM/PostgreSQL, Node test runner with `tsx`, Tailwind CSS 4.

## Global Constraints

- Default state is enabled (`1`) so deployment cannot unexpectedly stop generation.
- When disabled, role `admin` remains allowed and every other role is denied.
- Denied requests return HTTP `403`, code `IMAGE_GENERATION_DISABLED`, and message `生图功能暂时关闭`.
- The guard must run before prompt/image validation, credit checks or deductions, and upstream requests.
- Text-to-image, image-to-image, batch image edit, and OpenAI-compatible API-key image generation are covered.
- Reverse-prompt analysis remains available.
- Production migration is an idempotent direct SQL change after a database backup; do not modify or fabricate Drizzle migration-history rows.
- Follow the bundled Next.js 16 Route Handler documentation at `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.

---

## File Map

- Create `src/server/services/image-generation-access.ts`: pure role/flag policy and stable `ApiError` contract.
- Create `src/server/services/image-generation-access.test.ts`: policy regression tests.
- Modify `src/db/schema.ts`: add the persisted integer setting.
- Modify `src/server/services/site-settings.ts`: map, read, and update the setting and expose the DB-backed guard.
- Modify `src/server/services/image.ts`: invoke the guard at the top of all three shared generation services.
- Modify `src/app/api/admin/site-settings/route.ts`: accept admin toggle updates.
- Modify `src/app/api/config/route.ts`: include the setting in authenticated public config.
- Modify `src/types/index.ts` and `src/lib/store.ts`: type and initialize the frontend config flag.
- Modify `src/components/Admin/AdminSiteSettingsCard.tsx`: render and save the admin toggle.
- Modify `src/components/ImageGen/CreationPanel.tsx`: show the closed notice and disable text-to-image for ordinary users.
- Modify `src/components/ImageGen/Img2ImgPanel.tsx`: disable image-to-image submission for ordinary users.

---

### Task 1: Role-aware access policy

**Files:**
- Create: `src/server/services/image-generation-access.test.ts`
- Create: `src/server/services/image-generation-access.ts`

**Interfaces:**
- Produces: `canUseImageGeneration(role: string, enabled: boolean): boolean`
- Produces: `assertImageGenerationPolicy(role: string, enabled: boolean): void`

- [ ] **Step 1: Write the failing policy tests**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import {
  assertImageGenerationPolicy,
  canUseImageGeneration,
} from "./image-generation-access";

describe("image generation access policy", () => {
  it("allows ordinary users while the switch is enabled", () => {
    assert.equal(canUseImageGeneration("user", true), true);
  });

  it("blocks ordinary users with the stable API error while disabled", () => {
    assert.equal(canUseImageGeneration("user", false), false);
    assert.throws(
      () => assertImageGenerationPolicy("user", false),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        error.code === "IMAGE_GENERATION_DISABLED" &&
        error.message === "生图功能暂时关闭",
    );
  });

  it("keeps administrators enabled while the global switch is disabled", () => {
    assert.equal(canUseImageGeneration("admin", false), true);
    assert.doesNotThrow(() => assertImageGenerationPolicy("admin", false));
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --import tsx --test src/server/services/image-generation-access.test.ts`

Expected: FAIL because `./image-generation-access` does not exist.

- [ ] **Step 3: Implement the minimal pure policy**

```ts
import { ApiError } from "@/server/http";

export function canUseImageGeneration(role: string, enabled: boolean): boolean {
  return role === "admin" || enabled;
}

export function assertImageGenerationPolicy(
  role: string,
  enabled: boolean,
): void {
  if (!canUseImageGeneration(role, enabled)) {
    throw new ApiError(
      "生图功能暂时关闭",
      403,
      "IMAGE_GENERATION_DISABLED",
    );
  }
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node --import tsx --test src/server/services/image-generation-access.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Commit the policy**

```bash
git add src/server/services/image-generation-access.ts src/server/services/image-generation-access.test.ts
git commit -m "test: define image generation access policy"
```

---

### Task 2: Persist and expose the site setting

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/server/services/site-settings.ts`
- Modify: `src/app/api/admin/site-settings/route.ts`
- Modify: `src/app/api/config/route.ts`
- Modify: `src/types/index.ts`
- Modify: `src/lib/store.ts`

**Interfaces:**
- Consumes: `assertImageGenerationPolicy(role, enabled)` from Task 1.
- Produces: `getSiteSettings().imageGenerationEnabled: boolean`
- Produces: `setImageGenerationEnabled(enabled: boolean)`
- Produces: `assertImageGenerationAllowed(role: string): Promise<void>`
- Produces: authenticated `/api/config` field `imageGenerationEnabled: boolean`

- [ ] **Step 1: Add the enabled-by-default schema field**

Add beside `registrationEnabled` in `siteSettings`:

```ts
/** 普通用户生图总开关；管理员不受影响 */
imageGenerationEnabled: integer("image_generation_enabled")
  .notNull()
  .default(1),
```

- [ ] **Step 2: Map and update the setting in the site-settings service**

Import the pure assertion and add the mapped field:

```ts
import { assertImageGenerationPolicy } from "./image-generation-access";

imageGenerationEnabled: (row.imageGenerationEnabled ?? 1) !== 0,
```

Add the DB-backed helpers:

```ts
export async function isImageGenerationEnabled(): Promise<boolean> {
  const settings = await getSiteSettings();
  return settings.imageGenerationEnabled;
}

export async function assertImageGenerationAllowed(role: string): Promise<void> {
  assertImageGenerationPolicy(role, await isImageGenerationEnabled());
}

export async function setImageGenerationEnabled(enabled: boolean) {
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({
      imageGenerationEnabled: enabled ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(siteSettings.id, 1))
    .returning();
  return mapSettings(row!);
}
```

- [ ] **Step 3: Accept the admin update**

In `src/app/api/admin/site-settings/route.ts`, import `setImageGenerationEnabled`, add `imageGenerationEnabled?: boolean` to the request type, and handle it before returning:

```ts
if (typeof body.imageGenerationEnabled === "boolean") {
  await setImageGenerationEnabled(body.imageGenerationEnabled);
}
```

- [ ] **Step 4: Expose the flag to authenticated frontend config**

Import `isImageGenerationEnabled` in `src/app/api/config/route.ts`, then return:

```ts
return jsonOk({
  ...publicConfig(config),
  imageGenerationEnabled: await isImageGenerationEnabled(),
});
```

The current `requireActiveUser(req)` call remains before this database read. No caching directive is added because Next.js 16 Route Handlers are uncached by default and this value must reflect admin changes immediately.

- [ ] **Step 5: Add the frontend config type and safe initial value**

Add to `Config` in `src/types/index.ts`:

```ts
/** 普通用户是否可生图；管理员始终可用 */
imageGenerationEnabled?: boolean;
```

Add to `initialConfig` in `src/lib/store.ts`:

```ts
imageGenerationEnabled: true,
```

- [ ] **Step 6: Verify types and policy tests**

Run: `node --import tsx --test src/server/services/image-generation-access.test.ts`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: PASS with the new Drizzle field and config property recognized.

- [ ] **Step 7: Commit persistence and API wiring**

```bash
git add src/db/schema.ts src/server/services/site-settings.ts src/app/api/admin/site-settings/route.ts src/app/api/config/route.ts src/types/index.ts src/lib/store.ts
git commit -m "feat: persist image generation switch"
```

---

### Task 3: Enforce the switch in shared generation services

**Files:**
- Modify: `src/server/services/image.ts`
- Test: `src/server/services/image-generation-access.test.ts`

**Interfaces:**
- Consumes: `assertImageGenerationAllowed(role: string): Promise<void>` from Task 2.

- [ ] **Step 1: Extend the failing policy test for unknown/non-admin roles**

Add:

```ts
it("treats every non-admin role as an ordinary user", () => {
  assert.equal(canUseImageGeneration("api", false), false);
  assert.equal(canUseImageGeneration("", false), false);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --import tsx --test src/server/services/image-generation-access.test.ts`

Expected: this test should fail if policy handling was accidentally narrowed to only the literal `user` role; if it already passes, retain it as a regression test and proceed because it verifies the required API-key boundary.

- [ ] **Step 3: Add the central guard before every generation path**

Import:

```ts
import { assertImageGenerationAllowed } from "./site-settings";
```

In `generateImage`, immediately after destructuring `role` and before `prompt` validation:

```ts
await assertImageGenerationAllowed(role);
```

In `editImage`, immediately after destructuring `role` and before normalizing or validating `image`:

```ts
await assertImageGenerationAllowed(role);
```

In `editImageBatch`, immediately after destructuring `role` and before normalizing or validating `image`:

```ts
await assertImageGenerationAllowed(role);
```

Because the OpenAI-compatible `/api/v1/images/generations` route already calls `generateImage`, no route-specific guard is added. Because reverse-prompt analysis does not call these services, it remains available.

- [ ] **Step 4: Run focused and full tests**

Run: `node --import tsx --test src/server/services/image-generation-access.test.ts src/server/services/image-credit-policy.test.ts`

Expected: all focused tests pass.

Run: `npm test`

Expected: all project tests pass.

- [ ] **Step 5: Commit enforcement**

```bash
git add src/server/services/image.ts src/server/services/image-generation-access.test.ts
git commit -m "feat: enforce image generation switch"
```

---

### Task 4: Add the admin toggle and user-facing closed state

**Files:**
- Modify: `src/components/Admin/AdminSiteSettingsCard.tsx`
- Modify: `src/components/ImageGen/CreationPanel.tsx`
- Modify: `src/components/ImageGen/Img2ImgPanel.tsx`

**Interfaces:**
- Consumes: `/api/admin/site-settings` field `imageGenerationEnabled`.
- Consumes: Zustand `config.imageGenerationEnabled`.
- Produces: `Img2ImgPanelProps.disabled?: boolean`.

- [ ] **Step 1: Add the admin-card state, loading, and update action**

In `AdminSiteSettingsCard`, add state:

```ts
const [imageGenerationEnabled, setImageGenerationEnabled] = useState(true);
```

Extend the load response type and assignment:

```ts
imageGenerationEnabled?: boolean;

setImageGenerationEnabled(data.imageGenerationEnabled !== false);
```

Add the update action:

```ts
async function toggleImageGeneration(next: boolean) {
  setSaving(true);
  setMsg("");
  try {
    const data = await apiJson<{ imageGenerationEnabled?: boolean }>(
      "/api/admin/site-settings",
      {
        method: "PUT",
        ...jsonBody({ imageGenerationEnabled: next }),
      },
    );
    setImageGenerationEnabled(data.imageGenerationEnabled !== false);
    setMsg(next ? "已开放用户生图" : "已关闭用户生图");
  } catch (error: unknown) {
    setMsg(error instanceof Error ? error.message : "更新失败");
  }
  setSaving(false);
}
```

- [ ] **Step 2: Render the admin toggle beside the registration gate**

Add a second settings row with title `用户生图`, explanation `关闭后普通用户与其 API Key 无法生图，管理员不受影响`, `aria-pressed={imageGenerationEnabled}`, and button text `开放中` / `已关闭`. Wire it to:

```tsx
onClick={() => toggleImageGeneration(!imageGenerationEnabled)}
```

Update the card subtitle to `注册、生图与登录页联系方式`.

- [ ] **Step 3: Add an explicit disabled prop to image-to-image**

Extend `Img2ImgPanelProps` and its destructuring:

```ts
disabled?: boolean;
```

At the top of `handleGenerate`, guard with:

```ts
if (disabled || refs.length === 0 || generating) return;
```

Disable the upload and generate buttons using `disabled`, and render this notice above the upload controls when disabled:

```tsx
{disabled ? (
  <p className="text-xs rounded-lg px-3 py-2" style={{ color: "var(--warning)", background: "var(--warning-surface)" }}>
    生图功能暂时关闭
  </p>
) : null}
```

- [ ] **Step 4: Disable ordinary-user text-to-image while preserving reverse prompt**

Read `config` from `useDeepRoastStore` and derive:

```ts
const imageGenerationAvailable = isAdmin || config.imageGenerationEnabled !== false;
```

Add `!imageGenerationAvailable` to `submitText`'s early-return condition. Pass `disabled={generating || !imageGenerationAvailable}` to `TextToImageForm`, pass `disabled={!imageGenerationAvailable}` to `Img2ImgPanel`, and include `!imageGenerationAvailable` in the text generation button's disabled expression.

For the text mode footer, replace the cost row with this notice when unavailable:

```tsx
{!imageGenerationAvailable ? (
  <p className="text-xs rounded-lg px-3 py-2" style={{ color: "var(--warning)", background: "var(--warning-surface)" }}>
    生图功能暂时关闭，请稍后再试
  </p>
) : (
  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
    <span>{isAdmin ? "管理员免费" : `预计 ${cost} 积分`}</span>
    {!isAdmin ? <span>余额 {credits}</span> : null}
  </div>
)}
```

Do not change `ReversePromptPanel`; it remains enabled unless a generation task itself is running.

- [ ] **Step 5: Run focused lint and type checks**

Run:

```bash
npx eslint src/components/Admin/AdminSiteSettingsCard.tsx src/components/ImageGen/CreationPanel.tsx src/components/ImageGen/Img2ImgPanel.tsx src/app/api/admin/site-settings/route.ts src/app/api/config/route.ts src/server/services/site-settings.ts src/server/services/image-generation-access.ts src/server/services/image-generation-access.test.ts
```

Expected: PASS with no new lint errors.

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit the frontend state**

```bash
git add src/components/Admin/AdminSiteSettingsCard.tsx src/components/ImageGen/CreationPanel.tsx src/components/ImageGen/Img2ImgPanel.tsx
git commit -m "feat: add image generation admin toggle"
```

---

### Task 5: Build, review, migrate, and deploy

**Files:**
- Review all files listed above.
- Production-only SQL: `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS image_generation_enabled integer NOT NULL DEFAULT 1;`

**Interfaces:**
- Production service: `deeproast.service`
- Production app directory: `/opt/deeproast`
- Production media: `/opt/deeproast-data/images` and `/opt/deeproast-data/uploads`

- [ ] **Step 1: Run the complete local verification suite**

Run: `npm test`

Expected: all tests pass.

Run: `npm.cmd run build`

Expected: Next.js production build succeeds.

- [ ] **Step 2: Review only the feature diff**

Run:

```bash
git diff -- src/db/schema.ts src/server/services/site-settings.ts src/server/services/image-generation-access.ts src/server/services/image-generation-access.test.ts src/server/services/image.ts src/app/api/admin/site-settings/route.ts src/app/api/config/route.ts src/types/index.ts src/lib/store.ts src/components/Admin/AdminSiteSettingsCard.tsx src/components/ImageGen/CreationPanel.tsx src/components/ImageGen/Img2ImgPanel.tsx
```

Expected: no unrelated user changes, no secrets, and all four required generation paths are covered through the shared service.

- [ ] **Step 3: Stage a release without disturbing persistent media**

Clone the current live directory to `/opt/deeproast-release-image-switch-20260820`, upload only changed source files, then temporarily replace staging-only `public/images` and `public/uploads` symlinks with empty directories for the Turbopack build. After `npm run build`, remove those empty staging directories and restore links to `/opt/deeproast-data/images` and `/opt/deeproast-data/uploads`.

- [ ] **Step 4: Back up and migrate PostgreSQL**

Create `/opt/deeproast-backups/pre-image-switch-20260820.dump`, then execute exactly:

```sql
ALTER TABLE site_settings
ADD COLUMN IF NOT EXISTS image_generation_enabled integer NOT NULL DEFAULT 1;
```

Verify with:

```sql
SELECT image_generation_enabled FROM site_settings WHERE id = 1;
```

Expected: `1`. Do not write to `__drizzle_migrations` because production migration history is currently empty despite an already-migrated schema.

- [ ] **Step 5: Atomically switch the release with rollback protection**

Move the live directory to `/opt/deeproast-rollback-image-switch-20260820`, move the staged release to `/opt/deeproast`, restart `deeproast.service`, and automatically restore the rollback directory if the service does not become active.

- [ ] **Step 6: Verify production**

Run service-status and HTTP checks. Expected:

- `systemctl is-active deeproast.service` returns `active`.
- `https://deeproast.sryze.cc/login` returns HTTP 200.
- `site_settings.image_generation_enabled` exists and remains `1` after deployment.
- Admin site settings load the new switch.
- Turning the switch off makes ordinary-user generation requests return `403 / IMAGE_GENERATION_DISABLED`, while admin generation and reverse prompt remain usable; turn it back on after the smoke test unless the user requests it left closed.

- [ ] **Step 7: Commit final verification metadata if needed**

If implementation commits already contain all tracked source changes, do not create an empty commit. Otherwise commit only the remaining feature files with:

```bash
git commit -m "chore: finalize image generation switch"
```

