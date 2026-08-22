# 被邀请人奖励积分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有管理员邀请设置中增加被邀请人额外奖励积分配置，并在有效邀请注册时将其与固定 50 积分注册赠送叠加发放。

**Architecture:** 继续复用 `site_settings` 单行配置、`/api/admin/site-settings` 管理 API 和 `AdminSiteSettingsCard` 管理界面。注册事务读取两个邀请奖励配置，分别更新邀请人和被邀请人余额，并把双方实际金额写入积分流水与邀请历史；旧 API 字段和旧记录语义保持兼容。

**Tech Stack:** Next.js 16.2.10 App Router、React 19、TypeScript、Drizzle ORM、PostgreSQL、Node test runner、Tailwind CSS 4。

## Global Constraints

- 新用户固定注册赠送仍为 50 积分，被邀请人额外奖励默认 50 积分。
- 只对后续有效邀请注册生效，不补发历史积分，不修改无邀请码注册行为。
- `invitationReward` 和 `stats.totalReward` 保持原有邀请人奖励含义。
- 两个奖励都必须是非负整数；配置校验必须在任何数据库更新前完成。
- 奖励发放、邀请记录和积分流水必须在同一个数据库事务中完成。
- 保护工作区中已有未提交修改；每次暂存或提交只包含本功能明确修改的文件。
- 按项目 AGENTS.md 要求，写代码前阅读 `node_modules/next/dist/docs/` 中相关 Next.js 16 指南；本任务使用现有 Route Handler/API 模式，不新增 Server Action。

---

## 文件结构

- Create: `drizzle/0014_invitee_invitation_reward.sql` — 增加站点被邀请人奖励配置和邀请历史金额列。
- Create: `drizzle/meta/0014_snapshot.json` — Drizzle schema snapshot，由迁移生成命令更新。
- Create: `docs/superpowers/plans/2026-08-22-invitee-reward.md` — 本实施计划。
- Modify: `drizzle/meta/_journal.json` — 登记 0014 迁移。
- Modify: `src/db/schema.ts` — 增加两个奖励金额字段和积分流水类型注释。
- Modify: `src/db/migrations-contract.test.ts` — 锁定迁移字段、默认值、约束和历史兼容行为。
- Modify: `src/server/services/invitation-policy.ts` — 增加被邀请人奖励计算函数。
- Modify: `src/server/services/invitation-policy.test.ts` — 覆盖开关、有效邀请、0 奖励。
- Modify: `src/server/services/invitation-settings-input.ts` — 解析 `invitationInviteeReward`。
- Modify: `src/server/services/invitation-settings-input.test.ts` — 覆盖双奖励同时解析及新字段非法值。
- Modify: `src/server/services/site-settings.ts` — 返回新设置并持久化新设置。
- Modify: `src/app/api/admin/site-settings/route.ts` — 接受新管理 API 字段。
- Modify: `src/app/api/auth/register/route.ts` — 在原注册奖励之外发放被邀请人额外奖励。
- Modify: `src/server/services/invitations.ts` — 返回邀请人/被邀请人奖励历史和累计统计。
- Modify: `src/components/Admin/AdminSiteSettingsCard.tsx` — 增加被邀请人奖励输入并与邀请人奖励一起保存。
- Modify: `src/components/Admin/AdminInvitationsCard.tsx` — 展示被邀请人奖励统计和明细。

### Task 1: 先锁定设置、策略和迁移契约

**Files:**
- Modify: `src/server/services/invitation-settings-input.test.ts`
- Modify: `src/server/services/invitation-policy.test.ts`
- Modify: `src/db/migrations-contract.test.ts`

**Interfaces:**
- `parseInvitationSettingsPatch` 最终接受 `{ invitationEnabled?: unknown; invitationReward?: unknown; invitationInviteeReward?: unknown }` 并返回数字化的 `invitationInviteeReward`。
- `getInviteeInvitationReward(enabled, configuredReward, inviteeIsActiveUser, inviteCode)` 最终返回 `number | null`。
- 迁移必须提供 `site_settings.invitation_invitee_reward` 默认 50、非负约束和 `user_invitations.invitee_reward_amount` 默认 0。

- [ ] **Step 1: Write the failing tests**

在设置解析测试中加入：

```ts
test("parses inviter and invitee rewards together", () => {
  assert.deepEqual(
    parseInvitationSettingsPatch({
      invitationReward: "200",
      invitationInviteeReward: "50",
    }),
    { invitationReward: 200, invitationInviteeReward: 50 },
  );
});

test("rejects an invalid invitee reward", () => {
  assert.throws(
    () => parseInvitationSettingsPatch({ invitationInviteeReward: 1.5 }),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
});
```

在策略测试中加入：

```ts
test("returns the configured extra reward for a valid invitee", () => {
  assert.equal(
    getInviteeInvitationReward(true, 50, true, "abc"),
    50,
  );
  assert.equal(
    getInviteeInvitationReward(true, 0, true, "abc"),
    0,
  );
});

test("does not grant extra invitee reward without an eligible invitation", () => {
  assert.equal(getInviteeInvitationReward(false, 50, true, "abc"), null);
  assert.equal(getInviteeInvitationReward(true, 50, false, "abc"), null);
  assert.equal(getInviteeInvitationReward(true, 50, true, null), null);
});
```

在迁移契约测试中加入：

```ts
test("invitee reward migration preserves old balances and defaults history to zero", () => {
  assert.equal(existsSync("drizzle/0014_invitee_invitation_reward.sql"), true);
  const sql = readFileSync(
    "drizzle/0014_invitee_invitation_reward.sql",
    "utf8",
  );
  assert.match(sql, /invitation_invitee_reward/);
  assert.match(sql, /DEFAULT 50/);
  assert.match(sql, /invitee_reward_amount/);
  assert.match(sql, /DEFAULT 0/);
  assert.match(sql, /NON_NEGATIVE|non_negative|>= 0/i);
  assert.doesNotMatch(sql, /UPDATE "users"[\s\S]*credits/i);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
node --import tsx --test src/server/services/invitation-settings-input.test.ts src/server/services/invitation-policy.test.ts src/db/migrations-contract.test.ts
```

Expected: FAIL because the parser does not expose the new field, the policy function does not exist, and migration `0014_invitee_invitation_reward.sql` does not exist yet. Do not change the assertions to make this run pass.

### Task 2: Implement pure setting parsing and reward policy

**Files:**
- Modify: `src/server/services/invitation-settings-input.ts`
- Modify: `src/server/services/invitation-policy.ts`
- Test: `src/server/services/invitation-settings-input.test.ts`
- Test: `src/server/services/invitation-policy.test.ts`

**Interfaces:**
- `InvitationSettingsPatch` gains `invitationInviteeReward?: number`.
- `parseInvitationSettingsPatch` passes `body.invitationInviteeReward` through the existing `parseInvitationReward` validator.
- `getInviteeInvitationReward` mirrors `getInvitationReward` and returns `Math.max(0, Math.trunc(configuredReward))` only when the invitation is enabled, the invitee has a valid active inviter, and an invite code is present.

- [ ] **Step 1: Add the minimal parser implementation**

Extend the interface and parser as follows:

```ts
export interface InvitationSettingsPatch {
  invitationEnabled?: boolean;
  invitationReward?: number;
  invitationInviteeReward?: number;
}

export function parseInvitationSettingsPatch(body: {
  invitationEnabled?: unknown;
  invitationReward?: unknown;
  invitationInviteeReward?: unknown;
}): InvitationSettingsPatch {
  const patch: InvitationSettingsPatch = {};
  if (typeof body.invitationEnabled === "boolean") {
    patch.invitationEnabled = body.invitationEnabled;
  }
  if (body.invitationReward !== undefined) {
    patch.invitationReward = parseInvitationReward(body.invitationReward);
  }
  if (body.invitationInviteeReward !== undefined) {
    patch.invitationInviteeReward = parseInvitationReward(
      body.invitationInviteeReward,
    );
  }
  return patch;
}
```

- [ ] **Step 2: Add the minimal policy implementation**

Append beside `getInvitationReward`:

```ts
export function getInviteeInvitationReward(
  enabled: boolean,
  configuredReward: number,
  inviteeIsActiveUser: boolean,
  inviteCode: string | null,
): number | null {
  if (!enabled || !inviteCode || !inviteeIsActiveUser) return null;
  return Math.max(0, Math.trunc(configuredReward));
}
```

- [ ] **Step 3: Run the focused tests and verify GREEN**

Run the Task 1 command again. Expected: all setting parser and policy tests pass; only the migration contract remains failing because the schema/migration is not implemented yet.

### Task 3: Add schema fields and the idempotent database migration

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/migrations-contract.test.ts`
- Modify: `drizzle/meta/_journal.json`
- Create: `drizzle/0014_invitee_invitation_reward.sql`
- Create: `drizzle/meta/0014_snapshot.json`

**Interfaces:**
- `siteSettings.invitationInviteeReward` maps to `invitation_invitee_reward`, integer, not null, default 50.
- `userInvitations.inviteeRewardAmount` maps to `invitee_reward_amount`, integer, not null, default 0.
- Credit transaction type comments include `invitee_reward`.

- [ ] **Step 1: Extend the Drizzle schema**

Add the site setting next to `invitationReward`:

```ts
/** 被邀请人成功注册时获得的额外积分，允许为 0 */
invitationInviteeReward: integer("invitation_invitee_reward")
  .notNull()
  .default(50),
```

Extend the existing table check with a second check named `site_settings_invitation_invitee_reward_non_negative`, and add the history column next to `rewardAmount`:

```ts
inviteeRewardAmount: integer("invitee_reward_amount").notNull().default(0),
```

Update the credit transaction type comment to include `invitee_reward`.

- [ ] **Step 2: Generate the migration and inspect it**

Run:

```powershell
npx.cmd drizzle-kit generate --name invitee_invitation_reward
```

Expected: Drizzle creates `drizzle/0014_invitee_invitation_reward.sql`, updates `drizzle/meta/_journal.json`, and creates/updates the latest snapshot. Inspect the SQL and ensure it adds the two columns and non-negative checks without dropping tables, columns, or user balances. If generated names differ, keep the schema-derived names and update the migration contract assertions to match the actual SQL.

- [ ] **Step 3: Run migration contract and type checks**

Run:

```powershell
node --import tsx --test src/db/migrations-contract.test.ts
npx.cmd tsc --noEmit
```

Expected: migration contract and TypeScript checks pass.

### Task 4: Thread the setting through the admin API and UI

**Files:**
- Modify: `src/server/services/site-settings.ts`
- Modify: `src/app/api/admin/site-settings/route.ts`
- Modify: `src/components/Admin/AdminSiteSettingsCard.tsx`

**Interfaces:**
- `getSiteSettings()` returns `invitationInviteeReward: number` with fallback 50.
- `PUT /api/admin/site-settings` accepts `invitationInviteeReward?: number | string` and atomically persists both reward values after parser validation.
- The admin component sends `{ invitationReward, invitationInviteeReward }` in one request and displays both values.

- [ ] **Step 1: Update service mapping and persistence**

In `mapSettings`, add:

```ts
invitationInviteeReward: row.invitationInviteeReward ?? 50,
```

In `updateInvitationSettings`, add:

```ts
if (patch.invitationInviteeReward !== undefined) {
  values.invitationInviteeReward = patch.invitationInviteeReward;
}
```

- [ ] **Step 2: Update the route body type**

Add `invitationInviteeReward?: number | string` beside `invitationReward`; the existing `parseInvitationSettingsPatch(body)` call will validate both before `updateInvitationSettings` runs.

- [ ] **Step 3: Update the admin component state and load response**

Add:

```ts
const [invitationInviteeReward, setInvitationInviteeReward] = useState("50");
```

Extend the GET response type with `invitationInviteeReward?: number`, then initialize it with `String(data.invitationInviteeReward ?? 50)`.

- [ ] **Step 4: Replace the single reward save handler**

Use one handler that validates both controls before the request:

```ts
async function saveInvitationRewards() {
  const inviterRaw = invitationReward.trim();
  const inviteeRaw = invitationInviteeReward.trim();
  if (!/^\d+$/.test(inviterRaw) || !/^\d+$/.test(inviteeRaw)) {
    setMsg("两项奖励都必须是非负整数");
    return;
  }
  setSaving(true);
  setMsg("");
  try {
    const data = await apiJson<{
      invitationReward?: number;
      invitationInviteeReward?: number;
    }>("/api/admin/site-settings", {
      method: "PUT",
      ...jsonBody({
        invitationReward: Number(inviterRaw),
        invitationInviteeReward: Number(inviteeRaw),
      }),
    });
    setInvitationReward(String(data.invitationReward ?? inviterRaw));
    setInvitationInviteeReward(
      String(data.invitationInviteeReward ?? inviteeRaw),
    );
    setMsg("邀请奖励已保存，仅影响后续注册");
  } catch (e: unknown) {
    setMsg(e instanceof Error ? e.message : "保存失败");
  }
  setSaving(false);
}
```

Render the new label “被邀请人额外奖励积分” with `type="number"`, `min={0}`, `step={1}`, and keep the existing label for the inviter. Change the button handler to `saveInvitationRewards` and its text to “保存奖励设置”.

- [ ] **Step 5: Run focused parser and TypeScript checks**

Run:

```powershell
node --import tsx --test src/server/services/invitation-settings-input.test.ts
npx.cmd tsc --noEmit
```

Expected: parser tests pass and the admin component/API types compile.

### Task 5: Award the invitee and expose both amounts in invitation history

**Files:**
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/server/services/invitations.ts`
- Modify: `src/components/Admin/AdminInvitationsCard.tsx`
- Test: `src/server/services/invitation-policy.test.ts`

**Interfaces:**
- Registration reads `siteSettings.invitationInviteeReward` and uses `getInviteeInvitationReward` only after the inviter is a valid active normal user.
- `listAdminInvitations()` returns `inviteeRewardAmount` per row and `stats.totalInviteeReward`, while retaining `stats.totalReward`.

- [ ] **Step 1: Extend registration settings and reward calculation**

Add `invitationInviteeReward` to the settings select and import `getInviteeInvitationReward`. Inside the existing `if (inviter)` block, calculate both amounts:

```ts
const reward = getInvitationReward(
  invitationEnabled,
  settings?.invitationReward ?? 200,
  inviter.role === "user" && inviter.status === "active",
  inviteCode,
);
const inviteeReward = getInviteeInvitationReward(
  invitationEnabled,
  settings?.invitationInviteeReward ?? 50,
  inviter.role === "user" && inviter.status === "active",
  inviteCode,
);
```

After the inviter update, when `inviteeReward > 0`, update the newly created user’s `credits` with `sql\`${users.credits} + ${inviteeReward}\`` and insert a `creditTransactions` row with `type: "invitee_reward"`, the returned balance, and note `受邀注册额外奖励`. Always include `inviteeRewardAmount: inviteeReward` in the `userInvitations` insert. Keep the original `signup_bonus` amount 50 unchanged.

- [ ] **Step 2: Extend the admin invitation query**

Select `userInvitations.inviteeRewardAmount` in the row query. Add a second aggregate field:

```ts
totalInviteeReward: sql<number>`coalesce(sum(${userInvitations.inviteeRewardAmount}), 0)::int`,
```

Return `totalInviteeReward: Number(statsRows[0]?.totalInviteeReward ?? 0)` and map `inviteeRewardAmount` in every invitation row.

- [ ] **Step 3: Update the history card**

Add `inviteeRewardAmount` to `AdminInvitationRow` and `totalInviteeReward` to `AdminInvitationData.stats`. Add a second stat card labeled “被邀请人累计发放” with hint “被邀请人额外奖励积分”. In the table, render the reward cell as two lines: `邀请人 +{row.rewardAmount}` and `被邀请人 +{row.inviteeRewardAmount}`. Keep pagination and status behavior unchanged.

- [ ] **Step 4: Run focused behavior and type checks**

Run:

```powershell
node --import tsx --test src/server/services/invitation-policy.test.ts src/server/services/invitation-list-query.test.ts src/server/services/invitations.test.ts
npx.cmd tsc --noEmit
```

Expected: all focused tests pass and the registration/query/UI changes type-check.

### Task 6: Full verification and handoff

**Files:**
- Modify only the implementation files listed above; no unrelated working-tree files.

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm.cmd test
```

Expected: every test passes with no failures.

- [ ] **Step 2: Run lint on changed TypeScript files**

Run:

```powershell
npx.cmd eslint src/app/api/admin/site-settings/route.ts src/app/api/auth/register/route.ts src/components/Admin/AdminInvitationsCard.tsx src/components/Admin/AdminSiteSettingsCard.tsx src/db/migrations-contract.test.ts src/db/schema.ts src/server/services/invitation-policy.test.ts src/server/services/invitation-policy.ts src/server/services/invitation-settings-input.test.ts src/server/services/invitation-settings-input.ts src/server/services/invitations.ts src/server/services/site-settings.ts
```

Expected: ESLint exits 0.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm.cmd run build
```

Expected: Next.js production build completes successfully and generates the existing route set.

- [ ] **Step 4: Check diff scope and whitespace**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; the status may include the user’s pre-existing changes, but the feature diff contains only the planned files.

- [ ] **Step 5: Commit only the feature changes**

After reviewing `git diff` and excluding all unrelated existing changes:

```powershell
git add -- drizzle/0014_invitee_invitation_reward.sql drizzle/meta/0014_snapshot.json drizzle/meta/_journal.json src/db/migrations-contract.test.ts src/db/schema.ts src/app/api/admin/site-settings/route.ts src/app/api/auth/register/route.ts src/components/Admin/AdminInvitationsCard.tsx src/components/Admin/AdminSiteSettingsCard.tsx src/server/services/invitation-policy.test.ts src/server/services/invitation-policy.ts src/server/services/invitation-settings-input.test.ts src/server/services/invitation-settings-input.ts src/server/services/invitations.ts src/server/services/site-settings.ts
git commit -m "feat: add invitee invitation rewards"
```

Expected: one commit containing only the invitee reward feature; all existing unrelated modifications remain outside the commit.
