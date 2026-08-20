# Deeproast Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close configuration authorization and JWT exposure, prevent concurrent image-credit bypasses, and harden API-key issuance.

**Architecture:** Correct the existing handlers in place. Reuse the present PostgreSQL conditional credit update before any upstream call, add an explicit refund path for failed work, and centralize API-key quota checks in the service layer.

**Tech Stack:** Next.js 16, TypeScript, Drizzle/PostgreSQL, Node `node:test`, Redis limiter.

## Global Constraints

- Never read or alter `.env*` files.
- Synchronize only changed source/test files to `D:\工作\深焙-app`; back up divergent files as `.bak-<timestamp>`.
- Before release, configure a canonical HTTPS `PUBLIC_APP_URL`, then rotate `JWT_SECRET` and provider API credentials.
- Do not log or return secrets, raw upstream error bodies, or plaintext API keys after creation.

---

### Task 1: Close configuration authorization and JWT exposure

**Files:**
- Modify: `src/app/api/config/route.ts:79-82`
- Modify: `next.config.ts:6-13`
- Create: `src/server/services/security-guards.ts`
- Create: `src/server/services/security-guards.test.ts`

**Interfaces:**
- `assertCanonicalPublicOrigin(value: string | undefined): string` returns a canonical HTTPS origin or throws `ApiError(500)`.
- `PUT /api/config` awaits authorization before parsing input or mutating the DB.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import { assertCanonicalPublicOrigin } from "./security-guards";

describe("public origin", () => {
  it("normalizes a HTTPS root URL", () => {
    assert.equal(assertCanonicalPublicOrigin("https://app.example.com/"), "https://app.example.com");
  });
  it("rejects missing, HTTP, and path values", () => {
    for (const value of [undefined, "http://app.example.com", "https://app.example.com/path"]) {
      assert.throws(() => assertCanonicalPublicOrigin(value), (e: unknown) => e instanceof ApiError && e.status === 500);
    }
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/server/services/security-guards.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement minimal production change**

```ts
export function assertCanonicalPublicOrigin(value: string | undefined): string {
  try {
    const url = new URL(value || "");
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) throw new Error();
    return url.origin;
  } catch {
    throw new ApiError("PUBLIC_APP_URL 必须是 HTTPS 根域名", 500);
  }
}
```

Change the first statement in config `PUT` to `await requireAdmin(req);`. Delete the entire `env.JWT_SECRET` block from `next.config.ts`.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test src/server/services/security-guards.test.ts; npx tsc --noEmit`

Expected: PASS; no `JWT_SECRET` mapping remains in `next.config.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/config/route.ts next.config.ts src/server/services/security-guards.ts src/server/services/security-guards.test.ts
git commit -m "fix: enforce config authorization and keep jwt server-only"
```

### Task 2: Reserve image credits before invoking an upstream provider

**Files:**
- Modify: `src/server/services/credits.ts:34-75`
- Modify: `src/server/services/image.ts:12,151-153,189-300`
- Create: `src/server/services/image-credit-policy.test.ts`

**Interfaces:**
- `reserveCredits(userId, amount, note)` uses the existing conditional `UPDATE ... WHERE credits >= amount` before the remote fetch.
- `refundCredits(userId, amount, note)` restores one reservation and records transaction type `refund`.
- `shouldRetryImageError(error): boolean` returns false for every `ApiError`.

- [ ] **Step 1: Write the failing policy test**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import { shouldRetryImageError } from "./image";

describe("image retry policy", () => {
  it("does not retry insufficient credits", () => {
    assert.equal(shouldRetryImageError(new ApiError("积分不足", 402, "INSUFFICIENT_CREDITS")), false);
  });
  it("retries a transient upstream error", () => {
    assert.equal(shouldRetryImageError(new Error("timeout")), true);
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/server/services/image-credit-policy.test.ts`

Expected: FAIL because `shouldRetryImageError` is absent.

- [ ] **Step 3: Implement minimal production change**

Reserve credits immediately before the retry loop, using the existing atomic conditional update. Remove the success-path `consumeCredits` call. On terminal failure after a reservation, issue exactly one refund before returning an `ApiError(502, "UPSTREAM_IMAGE_ERROR")`. Use:

```ts
export function shouldRetryImageError(error: unknown): boolean {
  return !(error instanceof ApiError);
}
```

Log only bounded upstream diagnostics server-side; never concatenate `res.text()` into a client error.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test src/server/services/image-credit-policy.test.ts src/server/services/auth-password.test.ts; npm run lint`

Expected: PASS; a 402 is not retried and upstream response text is not client-visible.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/credits.ts src/server/services/image.ts src/server/services/image-credit-policy.test.ts
git commit -m "fix: reserve image credits before upstream generation"
```

### Task 3: Constrain API-key issuance and cache behavior

**Files:**
- Modify: `src/server/services/api-keys.ts:1-46`
- Modify: `src/app/api/user/api-keys/route.ts:1-19`
- Create: `src/server/services/api-keys.test.ts`
- Modify: `src/server/http.ts:22-25` only if optional response headers are added there.

**Interfaces:**
- `MAX_API_KEYS_PER_USER = 10`.
- `assertApiKeyQuota(existingCount: number): void` throws `ApiError(429, "API_KEY_QUOTA")` at ten.
- The create route invokes `enforceRateLimit("api-key-create", user.userId, 10, 3600)` and returns `Cache-Control: private, no-store`.

- [ ] **Step 1: Write the failing quota test**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import { assertApiKeyQuota, MAX_API_KEYS_PER_USER } from "./api-keys";

describe("API key quota", () => {
  it("allows fewer than ten keys", () => assert.doesNotThrow(() => assertApiKeyQuota(MAX_API_KEYS_PER_USER - 1)));
  it("rejects ten existing keys", () => {
    assert.throws(() => assertApiKeyQuota(MAX_API_KEYS_PER_USER), (e: unknown) => e instanceof ApiError && e.status === 429 && e.code === "API_KEY_QUOTA");
  });
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/server/services/api-keys.test.ts`

Expected: FAIL because quota exports are absent.

- [ ] **Step 3: Implement minimal production change**

Count a user’s existing API-key rows before generating random bytes; call `assertApiKeyQuota` before insertion. Apply the route-level user rate limit. Return the one-time plaintext key with:

```ts
return Response.json({ data: result }, {
  headers: { "Cache-Control": "private, no-store" },
});
```

Match the existing `jsonOk` response envelope if it uses one.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test src/server/services/api-keys.test.ts src/server/services/auth-password.test.ts; npm run lint`

Expected: PASS; key ten is rejected and no creation response is cacheable.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/api-keys.ts src/app/api/user/api-keys/route.ts src/server/services/api-keys.test.ts src/server/http.ts
git commit -m "fix: constrain api key issuance"
```

### Task 4: Validate v1 image input and return controlled image URLs

**Files:**
- Modify: `src/app/api/v1/images/generations/route.ts:1-52`
- Modify: `src/server/services/image.ts:18-43`
- Modify: `src/server/services/security-guards.test.ts`

**Interfaces:**
- `assertImageSize(size: string, model: string): string`.
- GPT image supports only the documented native sizes; other exposed models use an explicit finite allowlist.
- v1 URLs use `assertCanonicalPublicOrigin(process.env.PUBLIC_APP_URL)`, never request `Host` or forwarded-proto headers.

- [ ] **Step 1: Add failing validation tests**

```ts
it("rejects an unbounded upstream size", () => {
  assert.throws(() => assertImageSize("99999x99999", "doubao-seedream-4-5-251128"), (e: unknown) => e instanceof ApiError && e.status === 400);
});
it("accepts a documented GPT native size", () => {
  assert.equal(assertImageSize("1024x1792", "gpt-image-2"), "1024x1792");
});
```

- [ ] **Step 2: Verify RED**

Run: `npx tsx --test src/server/services/security-guards.test.ts`

Expected: FAIL because `assertImageSize` is absent.

- [ ] **Step 3: Implement validation and canonical URL use**

Validate size before `generateImage`. Construct each returned v1 URL with `PUBLIC_APP_URL`; retain database-relative paths as they are.

- [ ] **Step 4: Verify GREEN**

Run: `npx tsx --test src/server/services/security-guards.test.ts src/server/services/image-credit-policy.test.ts src/server/services/api-keys.test.ts src/server/services/auth-password.test.ts; npm run build`

Expected: all tests and production build PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/images/generations/route.ts src/server/services/image.ts src/server/services/security-guards.test.ts
git commit -m "fix: validate image gateway inputs"
```

### Task 5: Deploy and safely synchronize verified files

**Files:**
- Modify only committed source/test files from Tasks 1-4.
- Do not modify any `.env*` file.

- [ ] **Step 1: Copy only changed files with local backups**

Compare remote and local bytes for each changed path. For a divergent local source/test file create `<file>.bak-YYYYMMDD-HHMMSS` beside it, then copy the verified remote file. Exclude dependencies, build output, databases, images, and all environment files.

- [ ] **Step 2: Verify local code**

Run: `npx tsx --test src/server/services/security-guards.test.ts src/server/services/image-credit-policy.test.ts src/server/services/api-keys.test.ts src/server/services/auth-password.test.ts; npm run lint; npm run build`

Expected: PASS.

- [ ] **Step 3: Verify running behavior and rotate incident credentials**

Restart using the existing service workflow only after all checks pass. Confirm unauthenticated `PUT /api/config` receives 401/403 without a DB mutation. Set new `JWT_SECRET`, provider keys, and `PUBLIC_APP_URL` through existing deployment secret management, then inspect historical `PUT /api/config` logs without displaying secret values.
