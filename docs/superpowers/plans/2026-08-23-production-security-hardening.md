# DeepRoast Production Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变现有 `/api/v1`、API Key、生图模型参数和原图质量的前提下，修复高风险代码和生产入口问题，并完成可回滚发布。

**Architecture:** 从当前服务器工作树创建独立 `codex/production-hardening-20260823` worktree，将现有未提交代码作为只在新分支存在的基线快照，再按 TDD 分组件修复。新 worktree 同时作为发布目录，构建完成后通过 `/opt/deeproast-current` 原子符号链接切换 systemd；历史图片和上传目录只以符号链接共享，不复制、不重写。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript 5、Node.js test runner + tsx、Drizzle ORM、PostgreSQL 16、Sharp、Caddy 2.11、systemd、Docker。

## Global Constraints

- 用户 API 根地址保持 `https://deeproast.sryze.cc/api/v1`，现有 API Key 不轮换、不失效。
- 普通 JSON 最大 1 MiB；图生图 JSON 最大 30 MiB；参考图最多 5 张。
- 图片单边不超过 2048 像素，总像素不超过 4,194,304；现有最大 1920 像素选项必须继续可用。
- 提示词最多 2,000 字符；单条聊天内容最多 20,000 字符。
- 图片上游总超时 300 秒；模型目录自定义上游超时 20 秒。
- 不修改模型、提示词、上游 `quality`、尺寸映射、重试策略和成功原图字节；现有必要裁切除外。
- 不删除、归档、压缩、迁移或重新生成历史图片、缩略图及数据库图片记录。
- 2567、5661 对公网不可达但本机可达；Xray 8317 不修改。
- 未知错误不得向客户端返回内部异常；日志不得记录 API Key、Cookie、Authorization 或 Base64 图片正文。
- 所有代码修复先运行失败测试，再做最小实现；每个任务单独提交。

---

## File Map

**New application files**

- `src/server/safe-http.ts`: 公网 HTTPS 地址解析、私网阻断、DNS 结果固定、无重定向有界下载。
- `src/server/safe-http.test.ts`: URL、DNS 和响应大小策略测试。
- `src/server/http.test.ts`: JSON 有界读取与错误脱敏测试。
- `src/server/services/model-access.ts`: 管理员启用文本模型校验。
- `src/server/services/model-access.test.ts`: 创建、更新和聊天模型策略测试。
- `src/server/services/credit-reservation.test.ts`: 预扣和幂等退款测试。
- `src/server/services/chat-credit-policy.test.ts`: 聊天收费状态机与源码顺序契约。
- `src/server/services/image-safety.ts`: 尺寸、Data URL、本站图片和远程参考图安全处理。
- `src/server/services/image-safety.test.ts`: 图片输入、大小和不降质测试。
- `src/server/security-config.test.ts`: Next.js 安全响应头测试。
- `drizzle/0016_security_performance_indexes.sql`: 纯新增查询索引迁移。
- `ops/caddy/Caddyfile`: 可审计的 Cloudflare-only Caddy 配置。
- `ops/systemd/deeproast.service`: 低权限应用服务单元。
- `ops/systemd/deeproast-firewall.service`: Docker 上游端口防火墙持久化单元。
- `ops/bin/deeproast-firewall`: 幂等维护 DOCKER-USER 规则的脚本。

**Modified application files**

- `src/server/http.ts`: 有界 JSON 和未知错误脱敏。
- `src/app/api/image-edit/route.ts`, `src/app/api/image-edit/batch/route.ts`: 30 MiB 请求上限。
- `src/app/api/models/route.ts`, `src/server/services/models.ts`: 管理员权限和凭证隔离。
- `src/components/Settings/ModelManager.tsx`, `src/components/Settings/SettingsModal.tsx`: 已保存配置走 GET，自定义配置要求显式 Key。
- `src/server/services/conversations.ts`, `src/server/services/chat.ts`: 文本模型校验和聊天预扣。
- `src/server/services/credits.ts`: 余额与流水事务、预扣对象。
- `src/server/services/image.ts`: 图生图预扣、图片安全读取、超时和失败清理。
- `src/db/schema.ts`, `drizzle/meta/_journal.json`, `src/db/migrations-contract.test.ts`: 索引声明和迁移契约。
- `next.config.ts`, `package.json`, `package-lock.json`: 安全头和安全依赖。

---

### Task 1: Create an Isolated Production Baseline

**Files:**
- Worktree: `/opt/deeproast/releases/20260823-production-hardening`
- Source: `/opt/deeproast`

**Interfaces:**
- Consumes: 服务器当前 HEAD `9bf8567` 和当前未提交文件。
- Produces: 干净的 `codex/production-hardening-20260823` 分支，首个提交完整复现当前生产源码且不包含 `.env.production`、`node_modules`、`.next` 或历史图片。

- [ ] **Step 1: Re-audit the source worktree before copying**

Run:

```bash
cd /opt/deeproast
git status --short
git rev-parse HEAD
```

Expected: HEAD 为 `9bf8567`；状态只包含已知业务修改和 `0015_checkin_reward.sql`、`checkin-settings-input.ts`，没有新增未知文件。若列表改变，先停止并逐项核对归属。

- [ ] **Step 2: Create the release worktree**

Run:

```bash
sudo install -d -o GGG -g GGG -m 0755 /opt/deeproast/releases
git worktree add -b codex/production-hardening-20260823 /opt/deeproast/releases/20260823-production-hardening 9bf8567
```

Expected: 新 worktree 位于指定发布目录，原 `/opt/deeproast` 状态不变。

- [ ] **Step 3: Copy only the known current-production source changes**

Run from `/opt/deeproast`:

```bash
cp --parents drizzle/meta/_journal.json drizzle/0015_checkin_reward.sql src/app/api/admin/site-settings/route.ts src/app/api/auth/me/route.ts src/app/api/credits/checkin/route.ts src/app/page.tsx src/components/Admin/AdminSiteSettingsCard.tsx src/components/AppModals.tsx src/components/CreditWalletModal.tsx src/components/Header.tsx src/db/schema.ts src/hooks/useInitialData.ts src/lib/store.ts src/server/services/credits.ts src/server/services/site-settings.ts src/server/services/checkin-settings-input.ts /opt/deeproast/releases/20260823-production-hardening
```

Expected: `git status --short` in the worktree reproduces the same known source delta; no secrets or image files appear.

- [ ] **Step 4: Verify the copied baseline**

Run:

```bash
cd /opt/deeproast/releases/20260823-production-hardening
npm ci
npm test
npx tsc --noEmit --incremental false
```

Expected: 49 top-level tests / 82 assertions pass and TypeScript exits 0, matching the audited baseline.

- [ ] **Step 5: Commit the production baseline on the isolated branch**

```bash
git add drizzle/meta/_journal.json drizzle/0015_checkin_reward.sql src/app/api/admin/site-settings/route.ts src/app/api/auth/me/route.ts src/app/api/credits/checkin/route.ts src/app/page.tsx src/components/Admin/AdminSiteSettingsCard.tsx src/components/AppModals.tsx src/components/CreditWalletModal.tsx src/components/Header.tsx src/db/schema.ts src/hooks/useInitialData.ts src/lib/store.ts src/server/services/credits.ts src/server/services/site-settings.ts src/server/services/checkin-settings-input.ts
git commit -m "chore: capture current production source"
```

Expected: worktree clean；原 `/opt/deeproast` 未提交修改仍原样保留。

---

### Task 2: Bound JSON Bodies and Hide Internal Errors

**Files:**
- Create: `src/server/http.test.ts`
- Modify: `src/server/http.ts`
- Modify: `src/app/api/image-edit/route.ts`
- Modify: `src/app/api/image-edit/batch/route.ts`

**Interfaces:**
- Produces: `readJson<T>(req, options?: { maxBytes?: number }): Promise<T>`、`DEFAULT_JSON_MAX_BYTES`、`IMAGE_EDIT_JSON_MAX_BYTES`。
- Consumers: 所有 route handler；图生图路由显式使用 30 MiB。

- [ ] **Step 1: Write failing tests for bounded reads and generic 500s**

Create `src/server/http.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError, jsonError, readJson } from "./http";

describe("HTTP safety", () => {
  it("does not expose unknown exception messages", async () => {
    const response = jsonError(new Error("postgres password in stack"));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "服务器错误" });
  });

  it("rejects a body larger than the configured byte limit", async () => {
    const req = new Request("https://app.test/api", {
      method: "POST",
      body: JSON.stringify({ value: "1234567890" }),
    });
    await assert.rejects(
      () => readJson(req, { maxBytes: 8 }),
      (error: unknown) =>
        error instanceof ApiError && error.status === 413 &&
        error.code === "PAYLOAD_TOO_LARGE",
    );
  });

  it("keeps reviewed ApiError messages", async () => {
    const response = jsonError(new ApiError("参数错误", 400, "BAD_INPUT"));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "参数错误", code: "BAD_INPUT" });
  });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `node --import tsx --test src/server/http.test.ts`

Expected: FAIL because `readJson` has no options and `jsonError` returns the internal message.

- [ ] **Step 3: Implement streaming bounded JSON**

In `src/server/http.ts`, export constants and replace `jsonError`/`readJson` with:

```ts
export const DEFAULT_JSON_MAX_BYTES = 1024 * 1024;
export const IMAGE_EDIT_JSON_MAX_BYTES = 30 * 1024 * 1024;

export function jsonError(err: unknown, fallback = "服务器错误"): Response {
  if (err instanceof ApiError) {
    const body: { error: string; code?: string } = { error: err.message };
    if (err.code) body.code = err.code;
    return Response.json(body, { status: err.status, headers: err.headers });
  }
  console.error(err);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function readJson<T = Record<string, unknown>>(
  req: Request,
  options: { maxBytes?: number } = {},
): Promise<T> {
  const maxBytes = options.maxBytes ?? DEFAULT_JSON_MAX_BYTES;
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError("请求体过大", 413, "PAYLOAD_TOO_LARGE");
  }
  if (!req.body) throw new ApiError("请求体必须是 JSON", 400);

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel("payload too large");
        throw new ApiError("请求体过大", 413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("请求体必须是 JSON", 400);
  } finally {
    reader.releaseLock();
  }
}
```

Pass `{ maxBytes: IMAGE_EDIT_JSON_MAX_BYTES }` in both image-edit routes.

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --import tsx --test src/server/http.test.ts src/server/private-no-store.test.ts
npm test
```

Expected: focused tests and full suite pass.

- [ ] **Step 5: Commit**

```bash
git add src/server/http.ts src/server/http.test.ts src/app/api/image-edit/route.ts src/app/api/image-edit/batch/route.ts
git commit -m "fix: bound API request bodies and hide internal errors"
```

---

### Task 3: Isolate Model-Catalog Credentials and Block SSRF

**Files:**
- Create: `src/server/safe-http.ts`
- Create: `src/server/safe-http.test.ts`
- Create: `src/server/services/models.test.ts`
- Modify: `src/server/services/models.ts`
- Modify: `src/app/api/models/route.ts`
- Modify: `src/components/Settings/ModelManager.tsx`
- Modify: `src/components/Settings/SettingsModal.tsx`

**Interfaces:**
- Produces: `assertPublicHttpsUrl(value)`, `requestPublicHttpsBuffer(url, options)`, `resolveCatalogEndpoint(input, config)`.
- Consumers: 自定义模型目录请求和远程参考图下载。

- [ ] **Step 1: Write failing network-policy and credential tests**

`src/server/safe-http.test.ts` must assert that HTTPS public hosts pass, while `http:`, credentials in URLs, `127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`, `::1`, `fc00::/7`, mixed public/private DNS answers and responses over `maxBytes` fail.

`src/server/services/models.test.ts` must use a pure exported resolver:

```ts
assert.throws(
  () => resolveCatalogEndpoint(
    { baseUrl: "https://attacker.example/v1", apiKey: "" },
    { baseUrl: "http://127.0.0.1:5661/v1", arkApiKey: "server-secret" },
  ),
  (error: unknown) => error instanceof ApiError && error.status === 400,
);

assert.deepEqual(
  resolveCatalogEndpoint(
    { baseUrl: "https://catalog.example/v1", apiKey: "explicit" },
    { baseUrl: "http://127.0.0.1:5661/v1", arkApiKey: "server-secret" },
  ),
  { baseUrl: "https://catalog.example/v1", apiKey: "explicit", custom: true },
);
```

Add a route contract assertion that `POST` calls `requireAdmin(req)` and never `requireActiveUser(req)`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `node --import tsx --test src/server/safe-http.test.ts src/server/services/models.test.ts`

Expected: FAIL because the modules and resolver do not exist.

- [ ] **Step 3: Implement safe public HTTPS requests**

`src/server/safe-http.ts` must:

```ts
export interface SafeHttpOptions {
  headers?: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
}

export interface SafeHttpResult {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

export function assertPublicHttpsUrl(value: string): URL;
export async function requestPublicHttpsBuffer(
  value: string,
  options: SafeHttpOptions,
): Promise<SafeHttpResult>;
```

Use `dns/promises.lookup(hostname, { all: true, verbatim: true })`, reject if any answer belongs to loopback/private/link-local/multicast/unspecified IPv4 or IPv6 ranges, select one validated address, and pass a custom `lookup` callback to `https.request` so the connection uses that exact address while preserving the original hostname for TLS and Host. Do not follow 3xx responses. Abort at `timeoutMs`; destroy the response as soon as accumulated bytes exceed `maxBytes`.

- [ ] **Step 4: Separate saved and custom model credentials**

Export and use this resolver in `models.ts`:

```ts
export function resolveCatalogEndpoint(
  input: FetchCatalogInput,
  config: { baseUrl?: string | null; arkApiKey?: string | null } | null,
) {
  if (input.baseUrl !== undefined) {
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const apiKey = input.apiKey?.trim() || "";
    if (!baseUrl || !apiKey) {
      throw new ApiError("测试自定义 Base URL 时必须重新输入 API Key", 400);
    }
    assertPublicHttpsUrl(baseUrl);
    return { baseUrl, apiKey, custom: true as const };
  }
  const baseUrl = normalizeBaseUrl(config?.baseUrl || "");
  const apiKey = config?.arkApiKey?.trim() || process.env.ARK_API_KEY || process.env.GROK_API_KEY || "";
  if (!baseUrl || !apiKey) throw new ApiError("请先配置 API Base URL 和 API Key", 400);
  return { baseUrl, apiKey, custom: false as const };
}
```

For `custom: true`, call `requestPublicHttpsBuffer` with 20 seconds and 2 MiB. For saved configuration, retain the existing local-compatible `fetch` with `redirect: "error"` and the same timeout. Parse the returned body as JSON and never include its raw error text in public errors.

- [ ] **Step 5: Preserve the settings-page workflow**

Change `POST /api/models` to `requireAdmin(req)`. In `ModelManager`, call `GET /api/models` when the API Key field is blank and the current Base URL equals the saved Base URL; call `POST` only when both a custom Base URL and explicit API Key are present. Add `savedBaseUrl` as a prop from `SettingsModal`. If the Base URL changed while the Key is blank, show `修改 Base URL 时请重新输入 API Key` without making a request.

- [ ] **Step 6: Run tests, typecheck and commit**

```bash
node --import tsx --test src/server/safe-http.test.ts src/server/services/models.test.ts
npx tsc --noEmit --incremental false
git add src/server/safe-http.ts src/server/safe-http.test.ts src/server/services/models.ts src/server/services/models.test.ts src/app/api/models/route.ts src/components/Settings/ModelManager.tsx src/components/Settings/SettingsModal.tsx
git commit -m "fix: isolate model catalog credentials"
```

Expected: tests and typecheck pass; saved local upstream remains supported, arbitrary callers cannot receive a server-held key.

---

### Task 4: Enforce Enabled Text Models

**Files:**
- Create: `src/server/services/model-access.ts`
- Create: `src/server/services/model-access.test.ts`
- Modify: `src/server/services/conversations.ts`
- Modify: `src/server/services/chat.ts`

**Interfaces:**
- Produces: `assertEnabledTextModel(model, config): string`.
- Consumers: conversation create/update and chat execution.

- [ ] **Step 1: Write the failing policy test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "@/server/http";
import { assertEnabledTextModel } from "./model-access";

describe("text model access", () => {
  const config = {
    enabledTextModels: '["model-a","model-b"]',
    textModel: "model-a",
  };

  it("accepts an enabled model", () => {
    assert.equal(assertEnabledTextModel("model-b", config), "model-b");
  });

  it("rejects arbitrary and blank models", () => {
    for (const model of ["", "expensive-hidden-model"]) {
      assert.throws(
        () => assertEnabledTextModel(model, config),
        (error: unknown) => error instanceof ApiError && error.status === 400,
      );
    }
  });
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --import tsx --test src/server/services/model-access.test.ts`

Expected: FAIL because the helper is absent.

- [ ] **Step 3: Implement and wire the policy**

```ts
export function assertEnabledTextModel(
  value: string,
  config: {
    enabledTextModels?: string | null;
    textModel?: string | null;
  } | null,
): string {
  const model = value.trim();
  const enabled = parseEnabledModels(
    config?.enabledTextModels,
    defaultTextModelIds(),
    config?.textModel,
  );
  if (!model || !enabled.includes(model)) {
    throw new ApiError("指定的模型不可用", 400);
  }
  return model;
}
```

Load config once in `createConversation` and `updateConversation` when a model is supplied, and validate the stored conversation model again in `createChatStream` to cover legacy or manually altered rows.

- [ ] **Step 4: Test and commit**

```bash
node --import tsx --test src/server/services/model-access.test.ts
npx tsc --noEmit --incremental false
git add src/server/services/model-access.ts src/server/services/model-access.test.ts src/server/services/conversations.ts src/server/services/chat.ts
git commit -m "fix: restrict conversations to enabled models"
```

---

### Task 5: Make Credit Ledger Changes Transactional and Reservable

**Files:**
- Create: `src/server/services/credit-reservation.test.ts`
- Modify: `src/server/services/credits.ts`

**Interfaces:**
- Produces: `reserveCredits(userId, amount, debitNote): Promise<CreditReservation>`.
- Produces type: `CreditReservation = { refund(note: string): Promise<void> }`.
- Consumers: chat, text-to-image, image edit.

- [ ] **Step 1: Write a failing idempotency test with fake debit/refund functions**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createCreditReservation } from "./credits";

test("credit reservation refunds at most once", async () => {
  let refunds = 0;
  const reservation = createCreditReservation(async () => { refunds += 1; });
  await Promise.all([reservation.refund("failed"), reservation.refund("failed")]);
  assert.equal(refunds, 1);
});

test("a failed refund may be retried", async () => {
  let calls = 0;
  const reservation = createCreditReservation(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary database error");
  });
  await assert.rejects(() => reservation.refund("failed"));
  await reservation.refund("failed");
  assert.equal(calls, 2);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --import tsx --test src/server/services/credit-reservation.test.ts`

Expected: FAIL because `createCreditReservation` is absent.

- [ ] **Step 3: Implement transaction-backed mutations and reservation state**

Wrap each balance update and matching `creditTransactions` insert in one `db.transaction(async (tx) => ...)` callback. Do this for `consumeCredits` and `refundCredits`; retain the atomic `credits >= amount` predicate.

Add:

```ts
export interface CreditReservation {
  refund(note: string): Promise<void>;
}

export function createCreditReservation(
  refundAction: (note: string) => Promise<void>,
): CreditReservation {
  let refundPromise: Promise<void> | null = null;
  let refunded = false;
  return {
    async refund(note: string) {
      if (refunded) return;
      if (!refundPromise) {
        refundPromise = refundAction(note)
          .then(() => { refunded = true; })
          .catch((error) => { refundPromise = null; throw error; });
      }
      await refundPromise;
    },
  };
}

export async function reserveCredits(
  userId: string,
  amount: number,
  debitNote: string,
): Promise<CreditReservation> {
  await consumeCredits(userId, amount, debitNote);
  return createCreditReservation((note) =>
    refundCredits(userId, amount, note).then(() => undefined),
  );
}
```

- [ ] **Step 4: Verify and commit**

```bash
node --import tsx --test src/server/services/credit-reservation.test.ts
npx tsc --noEmit --incremental false
git add src/server/services/credits.ts src/server/services/credit-reservation.test.ts
git commit -m "fix: make credit reservations atomic"
```

---

### Task 6: Precharge Streaming Chat Safely

**Files:**
- Create: `src/server/services/chat-credit-policy.test.ts`
- Modify: `src/server/services/chat.ts`

**Interfaces:**
- Consumes: `reserveCredits`, `assertEnabledTextModel`.
- Produces: `createChatChargeState(reservation): { markContent(): void; failBeforeContent(note: string): Promise<void>; hasContent(): boolean }`.
- Produces: chat upstream call cannot begin without a successful reservation; no pre-content failure is charged.

- [ ] **Step 1: Write failing policy and source-order tests**

The test must assert `MAX_CHAT_MESSAGE_LENGTH === 20_000`, public error text equals `对话服务暂时不可用，请稍后重试`, and the source position of `await reserveCredits(` precedes `fetch(`${baseUrl}/chat/completions`` while the old `assertEnoughCredits` and post-response `consumeCredits` calls are absent.

Use a small exported state helper:

```ts
const refunds: string[] = [];
const state = createChatChargeState({ refund: async (note) => { refunds.push(note); } });
await state.failBeforeContent("上游失败");
await state.failBeforeContent("重复失败");
assert.equal(refunds.length, 1);

const charged = createChatChargeState({ refund: async () => { throw new Error("must not refund"); } });
charged.markContent();
await charged.failBeforeContent("late stream failure");
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --import tsx --test src/server/services/chat-credit-policy.test.ts`

Expected: FAIL because chat still charges after upstream completion and leaks errors.

- [ ] **Step 3: Implement the chat charge lifecycle**

- Reject trimmed messages longer than 20,000 characters.
- Validate `conv.model` with `assertEnabledTextModel`.
- Resolve endpoint before charging so configuration errors remain free.
- For non-admin users, call `reserveCredits` before inserting the user message or starting `fetch`.
- If history/message persistence fails before returning the stream, refund and rethrow.
- Add `signal: AbortSignal.timeout(180_000)` and `redirect: "error"` to upstream fetch.
- Read at most 2 KiB of an upstream error only for a sanitized server log; never emit it.
- Mark content on either `delta.content` or `delta.reasoning_content` before enqueueing.
- Refund once when fetch fails or the stream ends without any valid content.
- Keep the reservation when valid content was emitted, including later stream interruption or client cancellation.
- Emit only `对话服务暂时不可用，请稍后重试` for streaming failures.

- [ ] **Step 4: Run tests and commit**

```bash
node --import tsx --test src/server/services/chat-credit-policy.test.ts src/server/services/model-access.test.ts
npm test
git add src/server/services/chat.ts src/server/services/chat-credit-policy.test.ts
git commit -m "fix: reserve chat credits before upstream use"
```

---

### Task 7: Harden Image Inputs, Downloads and Charging Without Reducing Quality

**Files:**
- Create: `src/server/services/image-safety.ts`
- Create: `src/server/services/image-safety.test.ts`
- Modify: `src/server/services/image.ts`
- Modify: `src/server/services/image-credit-policy.test.ts`

**Interfaces:**
- Consumes: `requestPublicHttpsBuffer`, `reserveCredits`.
- Produces: `assertImageSize`, `normalizeReferenceImages`, `readUpstreamImage`, `preserveOrCropImage`.

- [ ] **Step 1: Write failing image safety and quality tests**

Cover these exact cases:

```ts
assert.equal(assertImageSize("1920x1080", "gpt-image-2"), "1920x1080");
assert.throws(() => assertImageSize("2049x1024", "gpt-image-2"), /尺寸/);
assert.equal(assertImageSize("2048x2048", "gpt-image-2"), "2048x2048");
assert.throws(() => assertImageSize("9999x9999", "gpt-image-2"), /尺寸/);

const original = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const unchanged = await preserveOrCropImage(original, "1024x1024", false);
assert.equal(unchanged, original);
assert.deepEqual(unchanged, original);
```

Also reject non-image Data URLs, malformed Base64, decoded input over the configured per-image limit, private remote URLs, redirects, non-image content types, and cumulative reference bytes over the total limit. Verify 1–5 valid reference images remain byte-equivalent after conversion to upstream Data URLs.

- [ ] **Step 2: Run and confirm RED**

Run: `node --import tsx --test src/server/services/image-safety.test.ts src/server/services/image-credit-policy.test.ts`

Expected: FAIL on unsafe sizes and missing helpers.

- [ ] **Step 3: Implement image safety helpers**

`image-safety.ts` must export:

```ts
export const MAX_IMAGE_EDGE = 2048;
export const MAX_IMAGE_PIXELS = 4_194_304;
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_REFERENCE_TOTAL_BYTES = 30 * 1024 * 1024;
export const IMAGE_UPSTREAM_TIMEOUT_MS = 300_000;

export function assertImageSize(size: string, model: string): string;
export async function normalizeReferenceImages(values: string[]): Promise<string[]>;
export async function readUpstreamImage(item: { b64_json?: string; url?: string }, baseUrl: string): Promise<Buffer>;
export async function preserveOrCropImage(buffer: Buffer, size: string, needsCrop: boolean): Promise<Buffer>;
```

`assertImageSize` parses positive integers, enforces edge/pixel limits, and then applies the existing non-crop allowlist. `normalizeReferenceImages` accepts `data:image/png|jpeg|webp;base64`, canonical `/images/<filename>` resources under the shared data root, and public HTTPS URLs downloaded through `safe-http`; it outputs Data URLs so the upstream never fetches user-controlled URLs. It performs no resize or re-encoding. `readUpstreamImage` estimates Base64 decoded size before `Buffer.from`, or safely downloads at most 25 MiB with image content type and no redirects. `preserveOrCropImage` returns the original Buffer object when `needsCrop` is false and calls the existing Sharp crop only when true.

- [ ] **Step 4: Wire text-to-image and image-edit flows**

For both generation paths:

- Add `AbortSignal.timeout(300_000)` and `redirect: "error"` to upstream POST.
- Replace unbounded `arrayBuffer()` with `readUpstreamImage`.
- Keep `quality: "high"`, model, prompt, `n`, request-size mapping and retry count unchanged.
- Use a per-attempt array of newly written paths and delete only those paths if persistence fails.
- Never scan or modify existing image directories.

For `editImageOnce`, replace `assertEnoughCredits` and success-time `consumeCredits` with one reservation before the attempt loop. Refund once after final failure. Normalize references before constructing `editPayload`. For `generateImage`, replace the boolean `creditsReserved` with the same reservation abstraction.

- [ ] **Step 5: Verify quality and charging tests**

Run:

```bash
node --import tsx --test src/server/services/image-safety.test.ts src/server/services/image-credit-policy.test.ts src/server/services/image-edit-runner.test.ts src/server/services/image-edit-tasks.test.ts
npx tsc --noEmit --incremental false
npm test
```

Expected: all pass; no test observes changed model, size, prompt, `quality`, retry count or non-crop bytes.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/image-safety.ts src/server/services/image-safety.test.ts src/server/services/image.ts src/server/services/image-credit-policy.test.ts
git commit -m "fix: harden image processing and precharge edits"
```

---

### Task 8: Add Query Indexes Without Changing Data

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0016_security_performance_indexes.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/db/migrations-contract.test.ts`

**Interfaces:**
- Produces: five additive indexes matching service query order.
- Consumers: conversation lists, message history, image history, transaction history, API Key administration.

- [ ] **Step 1: Write a failing migration contract test**

Append a test that reads `0016_security_performance_indexes.sql`, requires all five exact names below, requires `IF NOT EXISTS`, and rejects `DROP`, `DELETE`, `UPDATE`, `TRUNCATE` and `ALTER TABLE`.

```ts
const expected = [
  "conversations_user_updated_idx",
  "messages_conversation_created_idx",
  "image_generations_user_created_idx",
  "credit_transactions_user_created_idx",
  "api_keys_user_status_idx",
];
```

- [ ] **Step 2: Run and confirm RED**

Run: `node --import tsx --test src/db/migrations-contract.test.ts`

Expected: FAIL because migration 0016 does not exist.

- [ ] **Step 3: Add schema declarations and migration**

Import `index` from `drizzle-orm/pg-core`, add matching `pgTable` index callbacks, and create:

```sql
CREATE INDEX IF NOT EXISTS "conversations_user_updated_idx" ON "conversations" ("user_id", "updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" ("conversation_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "image_generations_user_created_idx" ON "image_generations" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_transactions_user_created_idx" ON "credit_transactions" ("user_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_user_status_idx" ON "api_keys" ("user_id", "status");
```

Append journal entry `idx: 11`, `tag: "0016_security_performance_indexes"`, `version: "7"`, `breakpoints: true`, with a monotonically increasing millisecond `when` value.

- [ ] **Step 4: Test and commit**

```bash
node --import tsx --test src/db/migrations-contract.test.ts
npx tsc --noEmit --incremental false
git add src/db/schema.ts drizzle/0016_security_performance_indexes.sql drizzle/meta/_journal.json src/db/migrations-contract.test.ts
git commit -m "perf: add indexes for user history queries"
```

---

### Task 9: Update Vulnerable Dependencies and Security Headers

**Files:**
- Create: `src/server/security-config.test.ts`
- Modify: `next.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: application-wide browser headers and patched production dependency graph.

- [ ] **Step 1: Read the installed Next.js 16 documentation**

Read completely:

```text
node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md
node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/poweredByHeader.md
```

Expected: implementation uses the documented `headers()` and `poweredByHeader` APIs for this installed Next.js generation.

- [ ] **Step 2: Write a failing config test**

Import `next.config.ts`, await `headers()`, flatten the wildcard rule, and assert:

```ts
assert.equal(config.poweredByHeader, false);
assert.equal(map.get("Strict-Transport-Security"), "max-age=31536000; includeSubDomains");
assert.equal(map.get("X-Content-Type-Options"), "nosniff");
assert.equal(map.get("Referrer-Policy"), "strict-origin-when-cross-origin");
assert.equal(map.get("X-Frame-Options"), "SAMEORIGIN");
assert.equal(map.get("Permissions-Policy"), "camera=(), microphone=(), geolocation=()");
assert.equal(map.has("Content-Security-Policy"), false);
```

- [ ] **Step 3: Run and confirm RED**

Run: `node --import tsx --test src/server/security-config.test.ts`

Expected: FAIL because the headers are absent.

- [ ] **Step 4: Add the documented Next.js config**

Add `poweredByHeader: false` and one `source: "/:path*"` rule containing exactly the values in Step 2. Do not add CSP in this release.

- [ ] **Step 5: Upgrade only the vulnerable dependency line**

Run:

```bash
npm install next@16.3.2 eslint-config-next@16.3.2 sharp@0.35.3
npm dedupe
npm audit --omit=dev
```

Expected: Next.js 16.3.2, eslint-config-next 16.3.2, Sharp 0.35.3, NanoID at least 3.3.18, PostCSS above 8.5.22, and zero high production vulnerabilities. Do not use `npm audit fix --force`. If NanoID remains below 3.3.18, add package override `"nanoid": "3.3.18"`, run `npm install`, and audit again.

- [ ] **Step 6: Run regression/build and commit**

```bash
node --import tsx --test src/server/security-config.test.ts
npm test
npx tsc --noEmit --incremental false
npm run build
npm audit --omit=dev
git add next.config.ts package.json package-lock.json src/server/security-config.test.ts
git commit -m "fix: update vulnerable runtime dependencies"
```

Expected: all commands exit 0 and generated originals are not touched.

---

### Task 10: Source-Control Production Hardening Config

**Files:**
- Create: `ops/caddy/Caddyfile`
- Create: `ops/systemd/deeproast.service`
- Create: `ops/systemd/deeproast-firewall.service`
- Create: `ops/bin/deeproast-firewall`

**Interfaces:**
- Consumes: Cloudflare official IP ranges, Docker `DOCKER-USER`, release symlink `/opt/deeproast-current`.
- Produces: validated, reversible production configuration.

- [ ] **Step 1: Record and verify official Cloudflare ranges**

Fetch `https://www.cloudflare.com/ips-v4` and `https://www.cloudflare.com/ips-v6` from the official domain. Compare them with the ranges embedded in `ops/caddy/Caddyfile`; every non-empty official line must appear exactly once. The Caddy global options must configure `trusted_proxies static`, `client_ip_headers CF-Connecting-IP X-Forwarded-For`, and `trusted_proxies_strict`.

- [ ] **Step 2: Create the Caddy configuration**

Preserve `grok.deeproast.sryze.cc → 127.0.0.1:5661` and `api.deeproast.sryze.cc → 127.0.0.1:2567`. In the `deeproast.sryze.cc` block, define `@notCloudflare { not remote_ip <official ranges> }`, respond 403 before handlers, retain direct file serving from `/opt/deeproast/public`, and proxy application traffic to `127.0.0.1:3000`. Add the same five security headers as `next.config.ts`.

- [ ] **Step 3: Create the low-privilege systemd unit**

Use exactly:

```ini
[Unit]
Description=Deep Roast Next.js App
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=deeproast
Group=deeproast
WorkingDirectory=/opt/deeproast-current
Environment=NODE_ENV=production
EnvironmentFile=/opt/deeproast/.env.production
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
MemoryMax=300M

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 4: Create idempotent Docker-port firewall files**

`ops/bin/deeproast-firewall` must support `apply` and `remove`, use `iptables` and `ip6tables` `DOCKER-USER` rules with `-m conntrack --ctorigdstport 2567|5661`, check with `-C` before insert/delete, and never touch port 8317. `ops/systemd/deeproast-firewall.service` must run after Docker, remain active after exit, apply on start and remove only its exact rules on stop.

- [ ] **Step 5: Validate offline and commit**

```bash
caddy validate --config ops/caddy/Caddyfile --adapter caddyfile
systemd-analyze verify ops/systemd/deeproast.service ops/systemd/deeproast-firewall.service
bash -n ops/bin/deeproast-firewall
git add ops/caddy/Caddyfile ops/systemd/deeproast.service ops/systemd/deeproast-firewall.service ops/bin/deeproast-firewall
git commit -m "ops: harden DeepRoast production services"
```

Expected: all validation commands pass and no production service changes yet.

---

### Task 11: Full Review and Release Candidate Gate

**Files:**
- Review: all files changed since the baseline commit.

**Interfaces:**
- Produces: a build-complete release candidate with recorded checksums and zero known high production dependency vulnerabilities.

- [ ] **Step 1: Run the full application gate**

```bash
npm test
npx tsc --noEmit --incremental false
npm run build
npm audit --omit=dev
```

Expected: all tests, typecheck and build pass; audit reports zero high vulnerabilities.

- [ ] **Step 2: Run lint on modified TypeScript files**

Run ESLint against the exact `.ts`/`.tsx` files returned by `git diff --name-only <baseline-commit>..HEAD`; do not loosen lint rules. Then run full `npm run lint` and record the pre-existing unrelated baseline errors separately.

Expected: modified files introduce no new lint errors. Existing unrelated React `set-state-in-effect` findings are not hidden or converted to warnings.

- [ ] **Step 3: Verify image quality invariants by source and tests**

Confirm the final diff keeps `quality: "high"`, the same model/prompt/size fields, the same native-size list and retry counts. Confirm `preserveOrCropImage` returns the same Buffer object for non-crop models and no command touched `/opt/deeproast/public/images`.

- [ ] **Step 4: Review the complete diff**

Run:

```bash
git diff --check <baseline-commit>..HEAD
git diff --stat <baseline-commit>..HEAD
git log --oneline --decorate <baseline-commit>..HEAD
```

Expected: only planned application, migration, dependency and ops files changed; no `.env`, image, generated `.next`, `node_modules` or secret material is tracked.

- [ ] **Step 5: Commit any review-only correction**

If review finds a concrete defect, add a regression test first, make the minimal fix, rerun the relevant gate, and commit only those files with `fix: address release review finding`. If no defect is found, do not create an empty commit.

---

### Task 12: Backup, Migrate, Cut Over and Observe

**Files:**
- Install: `/etc/caddy/Caddyfile`
- Install: `/etc/systemd/system/deeproast.service`
- Install: `/etc/systemd/system/deeproast-firewall.service`
- Install: `/usr/local/sbin/deeproast-firewall`
- Create: `/opt/deeproast-current` symlink
- Backup: `/opt/deeproast/.deploy-backups/<timestamp>/`

**Interfaces:**
- Consumes: release candidate from Task 11.
- Produces: running low-privilege production service with Cloudflare-only origin and reversible state.

- [ ] **Step 1: Create configuration and database backups**

Create a timestamped root-owned mode-0700 backup directory. Copy current Caddy/systemd files and record `git rev-parse HEAD`, `git status --short`, `systemctl status deeproast`, `docker ps`, listener state and major table counts. Produce a custom-format PostgreSQL backup without printing credentials:

```bash
sudo docker exec deeproast-pg sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > database.dump
sudo docker exec -i deeproast-pg sh -c 'exec pg_restore -l' < database.dump
```

Expected: dump is non-empty and `pg_restore -l` exits 0.

- [ ] **Step 2: Prepare shared runtime paths and service account**

Create the no-login `deeproast` system user if absent. Grant that user write access only to `/opt/deeproast/public/images`, `/opt/deeproast/public/uploads` and release `.next/cache`; retain root ownership elsewhere. Verify historical image file count and total bytes before and after permission changes are identical.

After the build is complete, replace only the release worktree's tracked empty `public/images` and `public/uploads` directories with symlinks to the existing `/opt/deeproast/public/images` and `/opt/deeproast/public/uploads`. Resolve both links and verify they remain under `/opt/deeproast` before proceeding.

- [ ] **Step 3: Run migration against the backed-up database**

Use the existing `/opt/deeproast/.env.production` through a transient systemd unit so no secret is echoed. Run `npm run db:migrate` from the release directory. Query `pg_indexes` for the five exact index names and compare major table counts with Step 1.

Expected: only migration 0016 and any already-versioned unapplied migration execute; all counts remain identical.

- [ ] **Step 4: Validate and install infrastructure files**

Run Caddy and systemd validation on the source-controlled files. Install backups first, then copy with root ownership and correct modes. Run `systemctl daemon-reload`; do not restart yet.

- [ ] **Step 5: Atomically switch the release and restart**

Create `/opt/deeproast-current.new` pointing to `/opt/deeproast/releases/20260823-production-hardening`, verify its resolved path, then atomically rename it to `/opt/deeproast-current`. Restart `deeproast`, start/enable `deeproast-firewall`, and reload Caddy.

Expected: DeepRoast becomes active under user/group `deeproast`; 3000 is listening locally for Caddy; local 2567/5661 health checks still work.

- [ ] **Step 6: Run production smoke tests**

Verify:

```text
https://deeproast.sryze.cc/                         -> 200 through Cloudflare
https://deeproast.sryze.cc/api/v1/models            -> 401 without Bearer Key
authenticated GET /api/v1/models                    -> 200 without consuming credits
direct-origin HTTPS using --resolve                  -> 403
20.41.121.31:2567 and 20.41.121.31:5661              -> connection blocked externally
127.0.0.1:2567 and 127.0.0.1:5661                    -> reachable locally
port 8317                                            -> unchanged
```

The authenticated smoke command must obtain and use an existing active key entirely inside the server process and must never print the key.

- [ ] **Step 7: Observe for at least 10 minutes**

Check `systemctl status`, `journalctl -u deeproast`, 5xx counts, upstream errors, memory peak and restart count at intervals no longer than 60 seconds. Do not run a paid generation. Success requires no restart loop, no new 5xx pattern, no secret leakage and stable memory below `MemoryMax`.

- [ ] **Step 8: Roll back on any trigger**

If a critical smoke test fails, API Key auth fails, DB counts change, 5xx persists, or service restarts, restore the backed-up Caddy/systemd/firewall files, point `/opt/deeproast-current` back to `/opt/deeproast`, reload/restart, and restore the database only if migration changed data or schema incompatibly. Keep the failed release directory for diagnosis; never delete historical images.

- [ ] **Step 9: Record final evidence**

Record release commit, dependency versions, audit summary, test/build results, migration/index verification, effective service user, public/direct-origin results, port checks, image file count/bytes and 10-minute observation. Report any remaining baseline lint issues and explicitly confirm no photo cleanup occurred.

---

## Final Acceptance Checklist

- [ ] Existing webpage and `/api/v1` users work with unchanged API Keys.
- [ ] Non-admin users cannot send custom model-catalog targets or exfiltrate server credentials.
- [ ] Concurrent chat/image requests cannot consume upstream service without a successful atomic reservation.
- [ ] Failed pre-content chat and failed image tasks refund at most once.
- [ ] Oversized JSON, references, downloads and pixel dimensions are rejected before expensive processing.
- [ ] Successful non-crop originals remain byte-identical and `quality: "high"` remains unchanged.
- [ ] Unknown and upstream errors are externally sanitized.
- [ ] Five additive indexes exist and table counts are unchanged.
- [ ] Next.js, Sharp, NanoID and PostCSS production vulnerability findings are cleared.
- [ ] DeepRoast runs as `deeproast`, only Cloudflare reaches the origin, and Docker ports 2567/5661 are externally blocked.
- [ ] Port 8317 and all historical photos remain untouched.
- [ ] Rollback materials are valid and production remains stable through the observation window.
