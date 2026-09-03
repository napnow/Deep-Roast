# Registration IP Limit Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore an administrator-controlled, persistent switch for the one-account-per-IP registration policy without changing the existing whitelist or request-rate limit.

**Architecture:** Store `registration_ip_limit_enabled` on the single `site_settings` row with a database default of `1`. The admin settings API and `AdminSiteSettingsCard` expose the value, while `/api/auth/register` evaluates the setting together with production mode and `REGISTRATION_BYPASS_IPS` through a small pure policy helper.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, PostgreSQL, Node test runner, ESLint.

## Global Constraints

- The setting defaults to enabled so existing production behavior is preserved after migration.
- Disabling the setting skips only the single-IP registration record check/write; the `REGISTER_IP_LIMIT = 10` request-rate limit remains active.
- Existing `REGISTRATION_BYPASS_IPS` entries remain exceptions while the setting is enabled.
- Toggling the setting never deletes historical `registration_records`.
- The current release must remain available for rollback until the new release passes health checks.

---

### Task 1: Add and test the registration IP policy helper

**Files:**
- Create: `src/server/services/registration-ip-limit.ts`
- Create: `src/server/services/registration-ip-limit.test.ts`
- Modify: `src/app/api/auth/register/route.ts`

**Interfaces:**
- Produces `shouldEnforceRegistrationIpLimit(ip: string, enabled: boolean, environment: string | undefined, bypassIps: readonly string[]): boolean`.
- The register route uses the helper for both its pre-check and transactional insert.

- [ ] **Step 1: Write the failing test**

```ts
test("enforces the policy only when enabled in production", () => {
  assert.equal(shouldEnforceRegistrationIpLimit("203.0.113.8", true, "production", []), true);
  assert.equal(shouldEnforceRegistrationIpLimit("203.0.113.8", false, "production", []), false);
  assert.equal(shouldEnforceRegistrationIpLimit("203.0.113.8", true, "production", ["203.0.113.8"]), false);
  assert.equal(shouldEnforceRegistrationIpLimit("203.0.113.8", true, "development", []), false);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/server/services/registration-ip-limit.test.ts`

Expected: FAIL because `registration-ip-limit.ts` and `shouldEnforceRegistrationIpLimit` do not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
export function shouldEnforceRegistrationIpLimit(
  ip: string,
  enabled: boolean,
  environment: string | undefined,
  bypassIps: readonly string[],
): boolean {
  if (!enabled || environment !== "production") return false;
  return !bypassIps.includes(ip);
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/server/services/registration-ip-limit.test.ts`

Expected: PASS.

- [ ] **Step 5: Replace the route's local policy branch**

Import the helper in `src/app/api/auth/register/route.ts`, remove the local `shouldSkipIpLimit`, and call the helper with `process.env.NODE_ENV`, the parsed `BYPASS_IPS`, and the persisted setting. The existing `REGISTER_IP_LIMIT` call remains unchanged.

### Task 2: Persist the setting in the database

**Files:**
- Modify: `src/db/schema.ts`
- Create: generated `drizzle/0020_*.sql`
- Create/modify: generated `drizzle/meta/0020_snapshot.json` and `drizzle/meta/_journal.json`

**Interfaces:**
- `siteSettings.registrationIpLimitEnabled` is an integer column with `notNull().default(1)`.

- [ ] **Step 1: Add the schema field**

```ts
/** 同一 IP 是否只能注册一个账号（1=开 0=关） */
registrationIpLimitEnabled: integer("registration_ip_limit_enabled")
  .notNull()
  .default(1),
```

- [ ] **Step 2: Generate the additive migration**

Run: `npm run db:generate`

Expected: a new `0020_*.sql` containing an additive `site_settings.registration_ip_limit_enabled` column with default `1`, plus the matching Drizzle metadata.

- [ ] **Step 3: Verify migration contents**

Run: `grep -n registration_ip_limit_enabled drizzle/0020_*.sql`

Expected: the new column appears with `NOT NULL DEFAULT 1`; no existing column is dropped or rewritten.

### Task 3: Expose the setting through the admin service and API

**Files:**
- Modify: `src/server/services/site-settings.ts`
- Modify: `src/app/api/admin/site-settings/route.ts`
- Create: `src/server/services/registration-ip-limit-settings-input.ts`
- Create: `src/server/services/registration-ip-limit-settings-input.test.ts`

**Interfaces:**
- `getSiteSettings()` returns `registrationIpLimitEnabled: boolean`.
- `setRegistrationIpLimitEnabled(enabled: boolean)` updates only the single settings row and returns mapped settings.
- `parseRegistrationIpLimitSettingsPatch(body)` returns `{ registrationIpLimitEnabled?: boolean }` and rejects non-boolean values with `ApiError` status 400.

- [ ] **Step 1: Write failing parser tests**

```ts
test("accepts only boolean registration IP limit updates", () => {
  assert.deepEqual(parseRegistrationIpLimitSettingsPatch({ registrationIpLimitEnabled: false }), {
    registrationIpLimitEnabled: false,
  });
  assert.deepEqual(parseRegistrationIpLimitSettingsPatch({}), {});
  assert.throws(() => parseRegistrationIpLimitSettingsPatch({ registrationIpLimitEnabled: "false" }), ApiError);
});
```

- [ ] **Step 2: Run parser tests and verify the expected failure**

Run: `npm test -- src/server/services/registration-ip-limit-settings-input.test.ts`

Expected: FAIL because the parser module does not exist.

- [ ] **Step 3: Implement the parser, service mapping, setter, and API field**

Use the existing invitation/check-in settings parser pattern. Add the field to the API body type, parse it before mutations, call `setRegistrationIpLimitEnabled`, and return it from GET/PUT through `getSiteSettings()`.

- [ ] **Step 4: Run the focused parser test**

Run: `npm test -- src/server/services/registration-ip-limit-settings-input.test.ts`

Expected: PASS.

### Task 4: Restore the management UI

**Files:**
- Modify: `src/components/Admin/AdminSiteSettingsCard.tsx`

**Interfaces:**
- The card loads `registrationIpLimitEnabled` from `/api/admin/site-settings`.
- The new control sends `{ registrationIpLimitEnabled: next }` through the existing authenticated PUT helper.

- [ ] **Step 1: Add the state, response field, loader assignment, and toggle handler**

Use the existing `registrationEnabled` pattern, with the visible labels `同一 IP 注册限制`, `开启后同一网络地址只能注册一个账号，关闭后允许多个账号`, `限制中`, and `不限制`.

- [ ] **Step 2: Render the independent control below “新用户注册”**

Keep the existing card styling and `saving` state. The new control must be separate from the global registration gate so disabling IP limiting does not imply that registration is open.

- [ ] **Step 3: Verify the UI contract in the production build**

Run: `npx tsc --noEmit --incremental false` and `npx eslint src/components/Admin/AdminSiteSettingsCard.tsx src/app/api/admin/site-settings/route.ts src/server/services/site-settings.ts src/server/services/registration-ip-limit-settings-input.ts`.

Expected: no TypeScript or ESLint errors.

### Task 5: Apply the setting in registration flow and document it

**Files:**
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `docs/security-hardening.md`
- Add tests in: `src/server/services/registration-ip-limit.test.ts`

**Interfaces:**
- The transaction selects `registrationIpLimitEnabled` and uses the pure helper before inserting `registrationRecords`.
- Existing unique-violation handling remains in place for concurrent registrations.

- [ ] **Step 1: Extend policy tests for the persisted setting and whitelist behavior**

Cover enabled/disabled, whitelist exception, and development behavior; do not alter the separate frequency-limit constant.

- [ ] **Step 2: Wire the persisted value into the pre-check and transaction**

Read the setting with a default of enabled for old/missing rows. When false, skip both the duplicate lookup and `registration_records` insert. Keep the existing error response and unique-violation handling for enabled mode.

- [ ] **Step 3: Update the security document**

Document the new admin control, its default, the fact that it does not remove historical records, and the distinction from the 10-per-hour request-rate limit.

- [ ] **Step 4: Run the focused and full checks once**

Run: `npm test -- src/server/services/registration-ip-limit.test.ts src/server/services/registration-ip-limit-settings-input.test.ts`, then `npm test`, `npx tsc --noEmit --incremental false`, and the targeted ESLint command from Task 4.

Expected: all tests pass and static checks exit 0.

### Task 6: Migrate, build, deploy, and smoke-test

**Files/Systems:**
- Database: production PostgreSQL used by `deeproast-pg`.
- Release: `/opt/deeproast-releases/20260903-registration-ip-limit`.
- Service: `deeproast.service` and `/opt/deeproast-current`.

- [ ] **Step 1: Apply the additive migration**

Run the repository migration command with the production environment, then query only the setting column to confirm its default is `1`; do not print credentials.

- [ ] **Step 2: Commit the implementation**

```bash
git add src/db/schema.ts drizzle/0020_*.sql drizzle/meta/0020_snapshot.json drizzle/meta/_journal.json src/server/services/registration-ip-limit.ts src/server/services/registration-ip-limit.test.ts src/server/services/registration-ip-limit-settings-input.ts src/server/services/registration-ip-limit-settings-input.test.ts src/server/services/site-settings.ts src/app/api/admin/site-settings/route.ts src/app/api/auth/register/route.ts src/components/Admin/AdminSiteSettingsCard.tsx docs/security-hardening.md
git commit -m "feat: restore registration IP limit toggle"
git push origin master
```

- [ ] **Step 3: Build an isolated release**

Archive the pushed commit into the new release directory, reuse the existing dependency tree inside that release, run `npm run build`, and attach the existing persistent `public/images` and `public/uploads` symlinks.

- [ ] **Step 4: Atomically switch and health-check**

Switch `/opt/deeproast-current`, restart only `deeproast.service`, poll `http://127.0.0.1:3000/` until it returns 200, and roll back to `/opt/deeproast-releases/20260903-admin-image-access` if startup fails.

- [ ] **Step 5: Verify the security boundary**

Confirm the service is active, root returns 200, unauthenticated admin settings remain unauthorized, and the release path is the new release. Report that the admin can now toggle the setting from “站点与内容 → 站点设置”.
