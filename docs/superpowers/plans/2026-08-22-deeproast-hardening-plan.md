# Deep Roast Hardening Implementation Plan

> **For agentic workers:** Execute this plan inline task-by-task with a verification checkpoint after each task.

**Goal:** Improve test coverage, lint hygiene, seed credential safety, and local secret permissions without changing existing administrator passwords or business data.

**Architecture:** Keep the existing Next.js/Node test setup. Use a small pure seed-policy helper so the new fail-closed administrator rule is independently testable, and make tooling/permission changes separately from application behavior.

**Tech Stack:** Next.js 16.2.10, TypeScript, Node `node:test`, `tsx`, ESLint 9 flat config, Drizzle seed script, Ubuntu file permissions.

## Global Constraints

- Do not read or print credential values.
- Do not reset or alter the current administrator password.
- Do not modify database rows, migrations, or the running systemd service.
- Do not delete rollback/build artifacts or historical backups.
- Preserve the existing 62 passing test cases.

---

### Task 1: Make the test command recursive

**Files:**
- Modify: `/opt/deeproast/package.json` (`scripts.test`)

**Interfaces:**
- Produces: `npm test` invokes Node with the quoted glob `src/**/*.test.ts`.

- [ ] **Step 1: Verify the baseline and target command**

Run `npm test` and `node --import tsx --test 'src/**/*.test.ts'`; baseline is 28 tests for the unquoted npm script and 62 tests for the quoted glob.

- [ ] **Step 2: Update the script**

Change the JSON script from `node --import tsx --test src/**/*.test.ts` to `node --import tsx --test "src/**/*.test.ts"` so the shell cannot shallow-expand the glob.

- [ ] **Step 3: Verify**

Run `npm test`; expected result is 62 passing tests.

### Task 2: Make administrator seeding fail closed

**Files:**
- Create: `/opt/deeproast/src/db/seed-policy.ts`
- Create: `/opt/deeproast/src/db/seed-policy.test.ts`
- Modify: `/opt/deeproast/src/db/seed.ts`

**Interfaces:**
- Produces: `requireAdminSeedPassword(value: string | undefined): string`.
- Behavior: trim configured values; throw `ADMIN_PASSWORD must be set before creating the admin user` for missing or blank values.

- [ ] **Step 1: Write the failing tests**

Test that `undefined` and whitespace-only input throw the exact error, and that a configured password is returned after trimming.

- [ ] **Step 2: Run the focused test**

Run `node --import tsx --test src/db/seed-policy.test.ts`; expected result is failure because the helper does not exist yet.

- [ ] **Step 3: Implement the minimal helper**

Add `requireAdminSeedPassword` with `const password = value?.trim(); if (!password) throw new Error("ADMIN_PASSWORD must be set before creating the admin user"); return password;`.

- [ ] **Step 4: Wire the seed script**

Import the helper in `seed.ts`, replace the `process.env.ADMIN_PASSWORD || "admin123"` expression with `requireAdminSeedPassword(process.env.ADMIN_PASSWORD)`, and remove the branch that logs the default password. Leave the existing-admin branch unchanged.

- [ ] **Step 5: Verify**

Run the focused test, then the full `npm test` and typecheck.

### Task 3: Reduce tooling noise and mechanical lint warnings

**Files:**
- Modify: `/opt/deeproast/eslint.config.mjs`
- Modify: `/opt/deeproast/src/app/api/v1/models/route.ts`
- Modify: `/opt/deeproast/src/server/rate-limit.ts`

**Interfaces:**
- ESLint ignores `.next-*/**`, `.deploy-backups/**`, and `**/*.rollback-`.
- API authentication remains enforced by calling `await requireApiUser(req)` without binding an unused variable.
- `rateLimitError` no longer accepts an unused retry value; callers pass no argument and the same 429 response is returned.

- [ ] **Step 1: Apply only mechanical changes**

Do not disable `react-hooks/set-state-in-effect`; leave those behavior-sensitive warnings for a separate UI refactor.

- [ ] **Step 2: Verify**

Run `./node_modules/.bin/eslint src` and `npm run lint`; generated rollback output must no longer create thousands of findings, and the two unused-variable warnings must be gone.

### Task 4: Tighten local secret and backup permissions

**Files:**
- Server state only: `/opt/deeproast/.env.production`, `/home/GGG/.env`, `/home/GGG/deeproast-*.sql`, `/home/GGG/deeproast-*.tgz`, and files in `/opt/deeproast/.deploy-backups/`.

**Interfaces:**
- Set existing files to mode `0600`; do not delete, move, or print contents.

- [ ] **Step 1: Record metadata without values**

Use `stat` to record owner, group, size, and mode only.

- [ ] **Step 2: Apply owner-only permissions**

Run `chmod 600` on the listed existing files.

- [ ] **Step 3: Verify metadata**

Run `stat` again and confirm each existing file is `0600` and owned by `GGG`.

### Task 5: Final verification and commit

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run the full verification set**

Run `npm test`, `./node_modules/.bin/tsc --noEmit --pretty false`, `npm run lint`, and `git diff --check`.

- [ ] **Step 2: Review the diff**

Confirm no `.env` file, credential value, database change, or deletion is staged.

- [ ] **Step 3: Commit**

Commit with `chore: harden Deep Roast verification and seed safety`.
