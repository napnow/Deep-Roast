# Recoverable API Key Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make newly created API Keys securely recoverable by their owner and redesign the API access modal into a clear, responsive management surface.

**Architecture:** Keep SHA-256 hashes as the authentication lookup and add AES-256-GCM encrypted key material for owner-only recovery. Expose recovery and rotation through dedicated uncached Route Handlers; keep list and admin responses metadata-only. Split formatting and cryptography into testable helpers, then update the client modal around those APIs.

**Tech Stack:** Next.js 16.2.10 App Router, React 19, TypeScript, Drizzle ORM/PostgreSQL, Node `crypto`, Node test runner, Tailwind CSS 4.

## Global Constraints

- Work from `/opt/deeproast`, the server's current source of truth, then sync the same files to `D:/工作/深焙-app`.
- Never store, log, or return plaintext API Keys from list or admin endpoints.
- Only the authenticated owner can reveal or rotate a Key.
- Existing hash-only Keys remain valid until their owner rotates or deletes them.
- `API_KEY_ENCRYPTION_KEY` is a dedicated 32-byte base64 secret and is never prefixed with `NEXT_PUBLIC_`.
- All secret responses use `Cache-Control: private, no-store`.
- Follow red-green-refactor for every behavior change.

---

### Task 1: Authenticated encryption primitive

**Files:**
- Create: `src/server/services/api-key-crypto.ts`
- Create: `src/server/services/api-key-crypto.test.ts`

**Interfaces:**
- Produces: `encryptApiKey(plainKey: string, encodedKey?: string): EncryptedApiKey`
- Produces: `decryptApiKey(payload: EncryptedApiKey, encodedKey?: string): string`
- Produces: `EncryptedApiKey = { ciphertext: string; iv: string; authTag: string }`

- [ ] **Step 1: Write failing encryption tests**

Test round-trip recovery, non-plaintext ciphertext, random IVs, missing configuration, malformed base64 key, and tampered authentication tags using a deterministic test key:

```ts
const testKey = Buffer.alloc(32, 7).toString("base64");
const first = encryptApiKey("sk-dr-secret", testKey);
assert.equal(decryptApiKey(first, testKey), "sk-dr-secret");
assert.notEqual(first.ciphertext, "sk-dr-secret");
assert.notEqual(first.iv, encryptApiKey("sk-dr-secret", testKey).iv);
assert.throws(() => encryptApiKey("x", ""), /加密配置/);
assert.throws(() => decryptApiKey({ ...first, authTag: "AAAA" }, testKey));
```

- [ ] **Step 2: Verify the tests fail for the missing module**

Run: `node --import tsx --test src/server/services/api-key-crypto.test.ts`

Expected: FAIL because `api-key-crypto.ts` does not exist.

- [ ] **Step 3: Implement AES-256-GCM**

Use `createCipheriv`, `createDecipheriv`, and `randomBytes(12)`. Decode `encodedKey ?? process.env.API_KEY_ENCRYPTION_KEY`, require exactly 32 bytes, encode ciphertext/IV/tag as base64, and expose only the three functions/types above. Error messages must not include secrets or ciphertext.

- [ ] **Step 4: Verify green**

Run: `node --import tsx --test src/server/services/api-key-crypto.test.ts`

Expected: all crypto tests PASS.

- [ ] **Step 5: Commit the isolated primitive**

```bash
git add src/server/services/api-key-crypto.ts src/server/services/api-key-crypto.test.ts
git commit -m "feat: encrypt recoverable api keys"
```

### Task 2: Schema and service behavior

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/server/services/api-keys.ts`
- Modify: `src/server/services/api-keys.test.ts`
- Create through Drizzle: `drizzle/0011_*.sql`
- Modify through Drizzle: `drizzle/meta/_journal.json`
- Create through Drizzle: `drizzle/meta/0011_snapshot.json`

**Interfaces:**
- Consumes: `encryptApiKey`, `decryptApiKey`, `EncryptedApiKey`
- Produces: `ApiKeyRecord.recoverable: boolean`
- Produces: `getApiKeySecret(userId: string, keyId: string): Promise<{ plainKey: string }>`
- Produces: `rotateApiKey(userId: string, keyId: string): Promise<{ plainKey: string; record: ApiKeyRecord }>`

- [ ] **Step 1: Add failing service-rule tests**

Add pure tests showing that all three encrypted columns are required for recovery and that ownership errors remain indistinguishable:

```ts
assert.equal(hasRecoverableSecret({ keyCiphertext: "c", keyIv: "i", keyAuthTag: "t" }), true);
assert.equal(hasRecoverableSecret({ keyCiphertext: "c", keyIv: null, keyAuthTag: "t" }), false);
assert.throws(() => assertApiKeyOwnership("owner", "other"), (error: unknown) =>
  error instanceof ApiError && error.status === 404 && error.message === "Key 不存在"
);
```

- [ ] **Step 2: Verify red**

Run: `node --import tsx --test src/server/services/api-keys.test.ts`

Expected: FAIL because `hasRecoverableSecret` and `recoverable` do not exist.

- [ ] **Step 3: Add nullable encrypted columns and service methods**

Add `keyCiphertext`, `keyIv`, and `keyAuthTag` text columns. Extend metadata selections with a computed `recoverable` boolean, but never include encrypted columns or plaintext in `ApiKeyRecord`. Refactor insertion into one transaction-aware helper so create and rotate both save hash plus encrypted material. `getApiKeySecret` selects by both `id` and `userId`, rejects legacy rows with a 409 `API_KEY_NOT_RECOVERABLE`, and decrypts on demand. `rotateApiKey` locks by user, loads the owned row, creates a replacement with the same name, and deletes the old row inside one transaction.

- [ ] **Step 4: Generate and inspect migration 0011**

Run: `npm run db:generate -- --name recoverable_api_keys`

Expected SQL:

```sql
ALTER TABLE "api_keys" ADD COLUMN "key_ciphertext" text;
ALTER TABLE "api_keys" ADD COLUMN "key_iv" text;
ALTER TABLE "api_keys" ADD COLUMN "key_auth_tag" text;
```

Reject the migration if it drops, renames, or rewrites existing columns.

- [ ] **Step 5: Verify service tests**

Run: `node --import tsx --test src/server/services/api-keys.test.ts src/server/services/api-key-crypto.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit schema and service**

```bash
git add src/db/schema.ts src/server/services/api-keys.ts src/server/services/api-keys.test.ts drizzle
git commit -m "feat: persist recoverable api key secrets"
```

### Task 3: Owner-only secret and rotation routes

**Files:**
- Create: `src/app/api/user/api-keys/[id]/secret/route.ts`
- Create: `src/app/api/user/api-keys/[id]/rotate/route.ts`
- Create: `src/server/services/api-key-route-contract.test.ts`

**Interfaces:**
- Consumes: `getApiKeySecret`, `rotateApiKey`, `requireActiveUser`, `enforceRateLimit`
- Produces: `GET /api/user/api-keys/:id/secret`
- Produces: `POST /api/user/api-keys/:id/rotate`

- [ ] **Step 1: Write failing route-contract tests**

Read both route sources and assert that each calls `requireActiveUser`; the secret route calls `getApiKeySecret`; the rotate route calls `rotateApiKey` and a per-user rate limit; both include `Cache-Control: private, no-store`. Also assert admin route source never imports `getApiKeySecret` or `decryptApiKey`.

- [ ] **Step 2: Verify red**

Run: `node --import tsx --test src/server/services/api-key-route-contract.test.ts`

Expected: FAIL because both owner routes are missing.

- [ ] **Step 3: Implement Next.js 16 Route Handlers**

Use the existing asynchronous params convention:

```ts
type Context = { params: Promise<{ id: string }> };

export const GET = handleRoute(async (req, context: Context) => {
  const user = await requireActiveUser(req);
  const { id } = await context.params;
  return jsonOk(await getApiKeySecret(user.userId, id), 200, {
    "Cache-Control": "private, no-store",
  });
});
```

The rotate route uses POST, rate limit key `api-key-rotate`, limit 10 per user per hour, and returns the replacement with HTTP 200 and no-store headers.

- [ ] **Step 4: Verify green and type-check**

Run: `node --import tsx --test src/server/services/api-key-route-contract.test.ts && npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit routes**

```bash
git add src/app/api/user/api-keys src/server/services/api-key-route-contract.test.ts
git commit -m "feat: add owner api key recovery routes"
```

### Task 4: Testable UI formatting and copy behavior

**Files:**
- Modify: `src/lib/api-key-ui.ts`
- Modify: `src/lib/api-key-ui.test.ts`

**Interfaces:**
- Produces: `maskApiKey(prefix: string): string`
- Produces: `buildApiCurlExample(origin: string): string`
- Produces: `apiKeyRecoveryLabel(recoverable: boolean): string`

- [ ] **Step 1: Write failing helper tests**

```ts
assert.equal(maskApiKey("sk-dr-a1b2c3"), "sk-dr-a1b2c3••••••••");
assert.match(buildApiCurlExample("https://deeproast.sryze.cc"), /https:\/\/deeproast\.sryze\.cc\/api\/v1\/images\/generations/);
assert.equal(apiKeyRecoveryLabel(false), "旧版 Key，无法恢复");
```

Also assert the curl example contains Authorization, JSON content type, model, prompt, size, and `n`, with readable line breaks.

- [ ] **Step 2: Verify red**

Run: `node --import tsx --test src/lib/api-key-ui.test.ts`

Expected: FAIL because the new helpers do not exist.

- [ ] **Step 3: Implement minimal pure helpers**

Keep domain formatting in the helper so the component does not duplicate command strings. Preserve existing `extractPlainApiKey` and status labels for admin compatibility.

- [ ] **Step 4: Verify green**

Run: `node --import tsx --test src/lib/api-key-ui.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit helpers**

```bash
git add src/lib/api-key-ui.ts src/lib/api-key-ui.test.ts
git commit -m "feat: add api key display helpers"
```

### Task 5: Responsive API access modal

**Files:**
- Modify: `src/components/ApiKeysModal.tsx`
- Create: `src/components/ApiKeys/ApiKeyRow.tsx`
- Create: `src/components/ApiKeys/ApiQuickStart.tsx`
- Create: `src/components/ApiKeysModal.test.ts`

**Interfaces:**
- Consumes: metadata `recoverable`, secret route, rotate route, and UI helpers
- Produces: accessible create, reveal, copy, rotate, delete, and copy-example controls

- [ ] **Step 1: Write a failing source contract test**

Assert the modal and child components contain the user-facing controls `创建新 Key`, `显示`, `复制`, `重新生成`, `复制示例`; every icon-only button has an `aria-label`; the modal uses `max-w-[36rem]`; the code block uses `whitespace-pre-wrap break-words` and not horizontal scrolling.

- [ ] **Step 2: Verify red**

Run: `node --import tsx --test src/components/ApiKeysModal.test.ts`

Expected: FAIL because child components and required controls are missing.

- [ ] **Step 3: Refactor the modal into three visual zones**

Use a refined warm editorial treatment consistent with the existing cream/brown palette: a restrained key icon badge, `rounded-[1.5rem]`, a subtle border/shadow, 36rem desktop width, and a mobile-safe `max-h-[calc(100dvh-2rem)]`. Put the name label above the input, keep the primary create button visually dominant, and use compact list cards with clear metadata hierarchy.

Track recovered secrets by Key id in component state. `显示` fetches once per modal session; `复制` fetches when absent and writes to the clipboard without forcing reveal. Clear all recovered secrets when the modal closes. Never put secrets in localStorage, sessionStorage, URL state, or logs.

For legacy rows, show `重新生成`; require `window.confirm("重新生成后，旧 Key 会立即失效，是否继续？")`. On success replace the row, cache the returned new plaintext only for the modal session, and show a success message. Keep delete as a secondary danger action.

- [ ] **Step 4: Implement quick-start code block**

Build the command from `window.location.origin` after mount, wrap long lines, and provide `复制示例`. Use the placeholder `sk-dr-你的Key` rather than injecting a user's secret into the example.

- [ ] **Step 5: Verify focused and full tests**

Run: `node --import tsx --test src/components/ApiKeysModal.test.ts src/lib/api-key-ui.test.ts`

Expected: PASS.

Run: `npm test && npx tsc --noEmit`

Expected: all tests and type-check PASS.

- [ ] **Step 6: Commit UI**

```bash
git add src/components/ApiKeysModal.tsx src/components/ApiKeys src/components/ApiKeysModal.test.ts
git commit -m "feat: redesign api key access modal"
```

### Task 6: Server-first migration, build, smoke test, and local sync

**Files:**
- Modify server secret file: `/opt/deeproast/.env.production`
- Apply server migration: `/opt/deeproast/drizzle/0011_*.sql`
- Sync all changed files above to: `D:/工作/深焙-app`

**Interfaces:**
- Consumes: completed Tasks 1-5
- Produces: live recoverable API Keys and matching local source

- [ ] **Step 1: Back up exact server targets**

Create a timestamped archive containing the changed source files, Drizzle metadata, and `.env.production`. Record the current `deeproast.service` state and verify `/opt/deeproast/public/images` and `/opt/deeproast/public/uploads` remain symlinks to `/opt/deeproast-data`.

- [ ] **Step 2: Configure encryption secret without printing it**

Generate 32 random bytes as base64 and add one `API_KEY_ENCRYPTION_KEY=` entry to `.env.production`. Validate only that decoding produces 32 bytes; never print the value.

- [ ] **Step 3: Run migration and pre-deploy verification**

Run: `npm run db:migrate`

Expected: migration 0011 succeeds without changing existing Key rows.

Run: `npm test && npx tsc --noEmit`

Expected: all tests PASS and no type errors.

- [ ] **Step 4: Build with persistent media links protected**

Stop `deeproast.service`, temporarily move only the two public media symlinks to fixed backup paths, create empty placeholder directories, run `npm run build`, restore both original symlinks in an EXIT trap, and restart the service. Never remove or recursively modify `/opt/deeproast-data`.

- [ ] **Step 5: Smoke test production**

Verify:

```text
systemctl is-active deeproast.service => active
GET https://deeproast.sryze.cc/login => 200
public/images -> /opt/deeproast-data/images
public/uploads -> /opt/deeproast-data/uploads
```

Authenticate with a test/user session only if one is already safely available; otherwise verify the route returns 401 without a session and inspect service logs for zero startup errors. Do not create or rotate a real user's Key for smoke testing.

- [ ] **Step 6: Sync server source back to local**

Download exactly the files changed in Tasks 1-5 plus migration 0011 and its metadata. Preserve unrelated local modifications, resolve overlaps file-by-file, then run locally:

`npm test && npx tsc --noEmit`

Expected: all local tests PASS with no unrelated file changes introduced.

- [ ] **Step 7: Final verification record**

Report migration success, build success, service status, public health status, symlink integrity, test counts, and the limitation that pre-update Keys require one rotation before they become copyable.
