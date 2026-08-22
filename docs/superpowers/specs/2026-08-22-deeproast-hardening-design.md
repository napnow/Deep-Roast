# Deep Roast Hardening Design

> Date: 2026-08-22

## Goal

Improve the deployed Deep Roast project's verification, lint hygiene, and credential handling without changing existing user passwords, deleting backups, touching business data, or restarting the service.

## Scope

1. Change the npm test script to pass the quoted recursive test glob to Node so all `src/**/*.test.ts` files run.
2. Extend ESLint global ignores to cover rollback build directories, deployment backups, and rollback-suffixed files.
3. Replace the known `admin123` seed fallback with fail-closed behavior: an administrator may only be created when `ADMIN_PASSWORD` is configured. Existing administrator rows are not changed.
4. Fix only mechanical source lint issues that do not change UI behavior; keep the React effect refactors as a separate follow-up.
5. Tighten permissions on production environment files and local database/archive backups to owner-only access. Do not delete them.

## Non-goals

- Do not reset or alter the current administrator password.
- Do not modify database records or migrations.
- Do not remove rollback/build artifacts or historical backups.
- Do not change the running systemd service or restart production.

## Verification

- `npm test` reports 62 passing tests.
- `tsc --noEmit --pretty false` succeeds.
- ESLint no longer scans generated rollback output; remaining behavior-sensitive React warnings are reported separately.
- `git diff --check` is clean for edited source/config files.
- File permissions are verified without printing credential values.

## Rollback

Code/config changes can be reverted by the resulting Git commit. Permission changes can be reverted explicitly if needed; no data is removed.
