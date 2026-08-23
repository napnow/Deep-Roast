# Production Hardening Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the important production-hardening review findings and publish a tested branch without changing the live release in place.

**Architecture:** Keep the existing service boundaries. Additive database indexes remain migration-owned, credit mutations use one database transaction for balance plus ledger, upstream streams retain their lifetime deadline, filesystem artifacts use same-directory temp files plus atomic rename, and Caddy rebuilds one canonical client-IP header at the proxy boundary.

**Tech Stack:** Next.js 16.3.2, TypeScript, Drizzle ORM, PostgreSQL, Caddy, Node test runner, ESLint.

## Global Constraints

- Never edit or rewrite the already-applied `0016_credit_reservation_identity.sql` migration.
- Add the five performance indexes only through `0017_security_performance_indexes.sql`.
- Do not run a build in `/opt/deeproast-current`; use a disposable worktree for build verification.
- Do not write secrets, `.env` files, `.next`, `node_modules`, or runtime image files into Git.
- Do not force-push or merge into `master`.

---

### Task 1: Add the missing query indexes

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0017_security_performance_indexes.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/db/migrations-contract.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

Add a test that reads `drizzle/0017_security_performance_indexes.sql`, requires these names and `IF NOT EXISTS`, and rejects destructive SQL:

```ts
test("security performance migration is additive and covers service query order", () => {
  assert.equal(existsSync("drizzle/0017_security_performance_indexes.sql"), true);
  const sql = readFileSync("drizzle/0017_security_performance_indexes.sql", "utf8");
  for (const name of [
    "conversations_user_updated_idx",
    "messages_conversation_created_idx",
    "image_generations_user_created_idx",
    "credit_transactions_user_created_idx",
    "api_keys_user_status_idx",
  ]) {
    assert.match(sql, new RegExp(`CREATE INDEX IF NOT EXISTS "${name}"`));
  }
  assert.doesNotMatch(sql, /\\b(DROP|DELETE|UPDATE|TRUNCATE|ALTER TABLE)\\b/i);
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --import tsx --test src/db/migrations-contract.test.ts`

Expected: FAIL because migration `0017` is absent.

- [ ] **Step 3: Implement the additive migration and schema declarations**

Add matching `index(...).on(...)` declarations to the five affected `pgTable` definitions and create:

```sql
CREATE INDEX IF NOT EXISTS "conversations_user_updated_idx" ON "conversations" ("user_id", "updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" ("conversation_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_generations_user_created_idx" ON "image_generations" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_user_created_idx" ON "credit_transactions" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_status_idx" ON "api_keys" ("user_id", "status");
```

Append journal entry `idx: 12`, version `7`, tag `0017_security_performance_indexes`, breakpoints true, with a timestamp greater than the existing last entry.

- [ ] **Step 4: Run focused verification**

Run: `node --import tsx --test src/db/migrations-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the task**

Run: `git add src/db/schema.ts drizzle/0017_security_performance_indexes.sql drizzle/meta/_journal.json src/db/migrations-contract.test.ts && git commit -m "perf: add security query indexes"`

---

### Task 2: Make credit mutations ledger-atomic

**Files:**
- Modify: `src/server/services/credits.ts`
- Modify: `src/server/services/credits.test.ts`

- [ ] **Step 1: Add failing source-contract tests**

Require `performCheckin` and `adjustCredits` to call `db.transaction`, and require their ledger insert to use the transaction handle. Add an integration test guarded by an explicit `CREDIT_INTEGRATION_DATABASE_URL` that performs concurrent check-ins for one user and verifies one success, one check-in ledger row, and a matching balance.

- [ ] **Step 2: Run tests and verify the new contract fails**

Run: `node --import tsx --test src/server/services/credits.test.ts`
Expected: the transaction-boundary assertion fails against the current implementation.

- [ ] **Step 3: Implement one transaction per operation**

Move the conditional balance update and the corresponding `creditTransactions` insert into the same `db.transaction(async (tx) => ...)` callback. Keep the existing atomic SQL predicates and error semantics. Use `tx.insert` for the ledger row and return the balance from the transaction.

- [ ] **Step 4: Run focused tests**

Run: `node --import tsx --test src/server/services/credits.test.ts`
Expected: PASS, including the optional PostgreSQL concurrency test when configured.

- [ ] **Step 5: Commit the task**

Run: `git add src/server/services/credits.ts src/server/services/credits.test.ts && git commit -m "fix: keep credit ledger mutations atomic"`

---

### Task 3: Keep chat stream deadlines and redact upstream diagnostics

**Files:**
- Modify: `src/server/services/chat.ts`
- Modify: `src/server/services/chat-credit-policy.test.ts`
- Create: `src/server/services/chat-stream-resilience.test.ts`

- [ ] **Step 1: Add failing tests**

Test the source contract that the 180-second timer is cleared in `finally`, after body consumption, and that upstream error logging does not include a raw response body. Add a mocked-stream test for a body that stalls after headers and verify the abort signal fires.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --import tsx --test src/server/services/chat-credit-policy.test.ts src/server/services/chat-stream-resilience.test.ts`
Expected: FAIL because the current code clears the timeout immediately after headers and logs the raw snippet.

- [ ] **Step 3: Implement the minimal fix**

Keep the timer handle in the stream attempt scope, consume the response body under the same deadline, and clear it in a `finally` block. Preserve client cancellation behavior. Replace raw upstream-body logging with status plus a fixed diagnostic marker.

- [ ] **Step 4: Run focused tests**

Run the same command from Step 2.
Expected: PASS.

- [ ] **Step 5: Commit the task**

Run: `git add src/server/services/chat.ts src/server/services/chat-credit-policy.test.ts src/server/services/chat-stream-resilience.test.ts && git commit -m "fix: bound chat stream lifetime"`

---

### Task 4: Write image artifacts atomically

**Files:**
- Modify: `src/server/services/image.ts`
- Modify: `src/server/services/image-safety.test.ts`

- [ ] **Step 1: Add a failing filesystem test**

Export a focused `writeFileAtomically` helper and test that it creates the final file with the exact bytes, leaves no temporary files after success, and removes the temporary file after a failed write.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test src/server/services/image-safety.test.ts`
Expected: FAIL because the helper is absent and production writes go directly to final paths.

- [ ] **Step 3: Implement same-directory temp write and rename**

Use `open(tempPath, "wx")`, `writeFile`, `sync`, `close`, and `rename` in the target directory. Generate a per-attempt temp name. On any failure close the handle and unlink only that temp path. Use the helper for both original images and thumbnails.

- [ ] **Step 4: Run focused image tests**

Run: `node --import tsx --test src/server/services/image-safety.test.ts src/server/services/image-credit-policy.test.ts src/server/services/image-edit-runner.test.ts src/server/services/image-edit-tasks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the task**

Run: `git add src/server/services/image.ts src/server/services/image-safety.test.ts && git commit -m "fix: atomically persist generated images"`

---

### Task 5: Rebuild the canonical client-IP boundary

**Files:**
- Modify: `ops/caddy/Caddyfile`
- Modify: `src/server/rate-limit.ts`
- Modify: `src/server/rate-limit.test.ts`
- Create: `ops/caddy/Caddyfile.test.ts`

- [ ] **Step 1: Add failing tests**

Assert the Caddy reverse-proxy blocks remove inbound `CF-Connecting-IP`, `X-Forwarded-For`, and `X-Real-IP` before setting `X-Real-IP {http.request.client_ip}`. Assert the application ignores spoofable Cloudflare and forwarded headers and uses only canonical `x-real-ip`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --import tsx --test src/server/rate-limit.test.ts ops/caddy/Caddyfile.test.ts`
Expected: FAIL against the current trust behavior and Caddyfile.

- [ ] **Step 3: Implement the boundary**

Add a reusable Caddy snippet imported inside each reverse proxy that strips the three inbound headers and rebuilds `X-Real-IP` and `X-Forwarded-For` from `{http.request.client_ip}`. Change `getClientIp` to trust only canonical `x-real-ip`.

- [ ] **Step 4: Run the focused tests**

Run the same command from Step 2.
Expected: PASS.

- [ ] **Step 5: Commit the task**

Run: `git add ops/caddy/Caddyfile ops/caddy/Caddyfile.test.ts src/server/rate-limit.ts src/server/rate-limit.test.ts && git commit -m "fix: sanitize proxy client identity headers"`

---

### Task 6: Full gate and publication

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.gitignore`
- Add: `docs/superpowers/specs/2026-08-23-production-hardening-review-remediation-design.md`
- Add: `docs/superpowers/plans/2026-08-23-production-hardening-review-remediation.md`

- [ ] **Step 1: Run all tests and checks in a disposable worktree**

Run `npm test`, `npx tsc --noEmit --incremental false`, modified-file ESLint, `npm audit --omit=dev`, and `npm run build` outside the active release directory. Record the known baseline full-lint errors if they remain unchanged.

- [ ] **Step 2: Apply and verify the migration on the database**

Run the existing migration command as the `deeproast` service user, verify `0017` is applied, and verify all five indexes exist with PostgreSQL catalog queries. Do not restart the service for a migration-only change unless required by the deployment process.

- [ ] **Step 3: Review staged hygiene**

Run `git diff --cached --check`, verify no `.env`, `.next`, `node_modules`, or runtime `public/images` paths are in the staged diff, and confirm the active image symlink still resolves.

- [ ] **Step 4: Commit publication metadata and push**

Create one final commit for the changelog, ignore rule, design, and plan. Push with:
```bash
git push -u origin codex/production-hardening-20260823
```
Never use `--force`.

- [ ] **Step 5: Verify the remote branch**

Run `git ls-remote --heads origin codex/production-hardening-20260823` and compare it with the local HEAD. Report the GitHub branch URL and test results.
