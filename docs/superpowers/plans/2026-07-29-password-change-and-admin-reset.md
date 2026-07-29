# Password Change + Admin Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users change their own password (old password required) and let admins reset any user’s password (hand-set or one-time generated), with register min length raised to 8 and a login-page “contact admin” hint.

**Architecture:** Pure password policy + generators live in `src/server/services/auth-password.ts`. Self-change uses `POST /api/auth/change-password` and **must read JWT from the cookie inside the route** (middleware intentionally skips `/api/auth/*` and does **not** inject `x-user-id` — same pattern as `src/app/api/auth/me/route.ts`). Admin reset uses `POST /api/admin/users/[id]/reset-password` under existing admin middleware + `requireAdmin`. UI: `ChangePasswordModal` from `UserMenu`, `ResetPasswordModal` from admin user detail, login hint copy only.

**Tech Stack:** Next.js 16 App Router, Drizzle + Postgres, jose JWT cookie, bcryptjs, existing `handleRoute` / `ApiError` / `apiJson` / `useToast`.

## Global Constraints

- Password minimum length: **8** (register, change, admin hand-set).
- Generated temporary password: **12** chars, alphanumeric; prefer excluding ambiguous `0OIl1`.
- No schema migration; only update `users.password` (+ `updatedAt`).
- No email / force-change-on-next-login / session revocation (JWT stays valid until expiry).
- Never log plaintext passwords.
- Chinese UI copy as in spec.
- Repo has **no** test framework; pure helpers use Node built-in `node --test`; HTTP uses curl manual checks + `tsc --noEmit`.

---

## File map

| Path | Responsibility |
|------|----------------|
| `src/server/services/auth-password.ts` | `MIN_PASSWORD_LENGTH`, `assertPasswordLength`, `generateTemporaryPassword`, `changeOwnPassword`, `adminResetPassword` |
| `src/app/api/auth/change-password/route.ts` | Cookie JWT auth + change body |
| `src/app/api/admin/users/[id]/reset-password/route.ts` | Admin reset body |
| `src/app/api/auth/register/route.ts` | Min length 4 → 8 |
| `src/components/Auth/ChangePasswordModal.tsx` | Self-change modal |
| `src/components/Header/UserMenu.tsx` | Menu entry + modal host |
| `src/components/Admin/ResetPasswordModal.tsx` | Admin reset modal |
| `src/app/admin/page.tsx` | Wire reset button + modal on selected user |
| `src/app/login/page.tsx` | Forgot-password hint |
| `src/server/services/auth-password.test.ts` | Node test for pure helpers |

---

### Task 1: Password policy + service helpers

**Files:**
- Create: `src/server/services/auth-password.ts`
- Create: `src/server/services/auth-password.test.ts`
- Test: `src/server/services/auth-password.test.ts`

**Interfaces:**
- Consumes: `hashPassword`, `comparePassword` from `@/lib/auth`; `db`, `users` schema; `eq` from drizzle; `ApiError` from `@/server/http`; `crypto.randomBytes`
- Produces:
  - `export const MIN_PASSWORD_LENGTH = 8`
  - `export function assertPasswordLength(password: string): void` — throws `ApiError(..., 400)` if `< 8`
  - `export function generateTemporaryPassword(length = 12): string`
  - `export async function changeOwnPassword(userId: string, oldPassword: string, newPassword: string): Promise<void>`
  - `export async function adminResetPassword(userId: string, opts: { password?: string; generate?: boolean }): Promise<{ username: string; temporaryPassword?: string }>`

- [ ] **Step 1: Write the failing pure-function tests**

Create `src/server/services/auth-password.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_PASSWORD_LENGTH,
  assertPasswordLength,
  generateTemporaryPassword,
} from "./auth-password";
import { ApiError } from "@/server/http";

describe("password policy", () => {
  it("exports min length 8", () => {
    assert.equal(MIN_PASSWORD_LENGTH, 8);
  });

  it("assertPasswordLength rejects short passwords", () => {
    assert.throws(() => assertPasswordLength("1234567"), (err: unknown) => {
      return err instanceof ApiError && err.status === 400;
    });
  });

  it("assertPasswordLength accepts length 8+", () => {
    assert.doesNotThrow(() => assertPasswordLength("12345678"));
  });

  it("generateTemporaryPassword returns 12 alnum chars by default", () => {
    const p = generateTemporaryPassword();
    assert.equal(p.length, 12);
    assert.match(p, /^[A-Za-z0-9]+$/);
    // ambiguous chars excluded
    assert.doesNotMatch(p, /[0OIl1]/);
  });

  it("generateTemporaryPassword is not constant", () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    // Extremely unlikely to collide; if flaky re-run once
    assert.notEqual(a, b);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```bash
cd "D:/工作/深焙-app"
node --import tsx --test src/server/services/auth-password.test.ts
```

Expected: fail to resolve `./auth-password` or similar.

- [ ] **Step 3: Implement `auth-password.ts`**

```ts
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { comparePassword, hashPassword } from "@/lib/auth";
import { ApiError } from "@/server/http";

export const MIN_PASSWORD_LENGTH = 8;

/** Alphanumeric without 0 O I l 1 */
const TEMP_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function assertPasswordLength(password: string): void {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(`密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`, 400);
  }
}

export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i]! % TEMP_PASSWORD_ALPHABET.length];
  }
  return out;
}

export async function changeOwnPassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  if (!oldPassword || !newPassword) {
    throw new ApiError("旧密码和新密码不能为空", 400);
  }
  assertPasswordLength(newPassword);
  if (newPassword === oldPassword) {
    throw new ApiError("新密码不能与旧密码相同", 400);
  }

  const [user] = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new ApiError("用户不存在", 404);
  }

  const ok = await comparePassword(oldPassword, user.password);
  if (!ok) {
    throw new ApiError("旧密码不正确", 401);
  }

  const hashed = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function adminResetPassword(
  userId: string,
  opts: { password?: string; generate?: boolean },
): Promise<{ username: string; temporaryPassword?: string }> {
  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new ApiError("用户不存在", 404);
  }

  let plain: string;
  let returnTemp = false;

  if (opts.generate) {
    plain = generateTemporaryPassword(12);
    returnTemp = true;
  } else if (opts.password) {
    assertPasswordLength(opts.password);
    plain = opts.password;
  } else {
    throw new ApiError("请提供 password 或 generate: true", 400);
  }

  const hashed = await hashPassword(plain);
  await db
    .update(users)
    .set({ password: hashed, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return returnTemp
    ? { username: user.username, temporaryPassword: plain }
    : { username: user.username };
}
```

- [ ] **Step 4: Run pure tests — expect PASS**

```bash
cd "D:/工作/深焙-app"
node --import tsx --test src/server/services/auth-password.test.ts
```

Expected: all tests pass. If path alias `@/` fails under tsx, run with:

```bash
npx tsx --tsconfig tsconfig.json --test src/server/services/auth-password.test.ts
```

or temporarily use relative imports in the test only (`from "./auth-password"` already relative; for ApiError use `from "../http"`). Prefer fixing the test import to relative `from "../http"` if alias breaks — **do not** change production imports.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/auth-password.ts src/server/services/auth-password.test.ts
git commit -m "$(cat <<'EOF'
feat: add password policy and change/reset service helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Align register min password length to 8

**Files:**
- Modify: `src/app/api/auth/register/route.ts` (lines checking `password.length < 4`)
- Modify (optional UX): `src/app/login/page.tsx` register placeholder only if present — **no** client min check required beyond server; login page may add client hint later in Task 6.

**Interfaces:**
- Consumes: `MIN_PASSWORD_LENGTH` from `@/server/services/auth-password` (or hardcode 8 matching constant — prefer import constant to stay DRY)
- Produces: register rejects passwords shorter than 8 with message `密码至少需要 8 个字符`

- [ ] **Step 1: Update register route**

In `src/app/api/auth/register/route.ts`, replace:

```ts
    if (password.length < 4) {
      return Response.json({ error: "密码至少需要 4 个字符" }, { status: 400 });
    }
```

with:

```ts
    if (password.length < 8) {
      return Response.json({ error: "密码至少需要 8 个字符" }, { status: 400 });
    }
```

Prefer importing `MIN_PASSWORD_LENGTH` if the route can import from server services without circular issues (it can):

```ts
import { MIN_PASSWORD_LENGTH } from "@/server/services/auth-password";
// ...
if (password.length < MIN_PASSWORD_LENGTH) {
  return Response.json(
    { error: `密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符` },
    { status: 400 },
  );
}
```

- [ ] **Step 2: Manual check (dev server running)**

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"pwtest_short","password":"1234567"}'
```

Expected JSON includes error about 8 chars, HTTP 400.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "$(cat <<'EOF'
feat: raise register password minimum to 8 characters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `POST /api/auth/change-password` route

**Files:**
- Create: `src/app/api/auth/change-password/route.ts`

**Interfaces:**
- Consumes: `verifyToken` from `@/lib/auth`; `changeOwnPassword` from service; `handleRoute`, `readJson`, `jsonOk`, `ApiError`
- Produces: `POST` handler; body `{ oldPassword, newPassword }`; success `{ success: true }`

**Critical auth note:** Middleware returns `NextResponse.next()` for all `/api/auth/*` **without** setting `x-user-id`. Do **not** use `requireUser(req)`. Parse cookie `token=` and `verifyToken` exactly like `src/app/api/auth/me/route.ts`.

- [ ] **Step 1: Create route**

```ts
import { verifyToken } from "@/lib/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { changeOwnPassword } from "@/server/services/auth-password";

function tokenFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
  return tokenMatch ? decodeURIComponent(tokenMatch[1]!) : null;
}

export const POST = handleRoute(async (req) => {
  const token = tokenFromCookie(req);
  if (!token) throw new ApiError("未登录", 401);

  const payload = await verifyToken(token);
  if (!payload?.userId) throw new ApiError("登录已过期", 401);

  const body = await readJson<{ oldPassword?: string; newPassword?: string }>(
    req,
  );
  await changeOwnPassword(
    payload.userId,
    body.oldPassword || "",
    body.newPassword || "",
  );
  return jsonOk({ success: true });
});
```

- [ ] **Step 2: Typecheck**

```bash
cd "D:/工作/深焙-app"
node node_modules/typescript/bin/tsc --noEmit
```

Expected: EXIT 0 (or only pre-existing unrelated errors — fix any introduced by this file).

- [ ] **Step 3: Manual curl (logged-in cookie)**

1. Login and capture cookie, or use browser DevTools Application → Cookies → `token`.
2. Wrong old password:

```bash
curl -s -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_TOKEN" \
  -d '{"oldPassword":"wrong-old","newPassword":"newpass12"}'
```

Expected: 401, `"旧密码不正确"`.

3. Short new password → 400.
4. Correct old → `{ "success": true }`; then login with new password works.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/change-password/route.ts
git commit -m "$(cat <<'EOF'
feat: add change-password API with cookie JWT auth

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: ChangePasswordModal + UserMenu entry

**Files:**
- Create: `src/components/Auth/ChangePasswordModal.tsx`
- Modify: `src/components/Header/UserMenu.tsx`

**Interfaces:**
- Consumes: `apiJson`, `jsonBody` from `@/lib/client-api`; `useToast` from `@/components/Toast`
- Produces: modal props `{ open: boolean; onClose: () => void }`; menu item「修改密码」

- [ ] **Step 1: Create ChangePasswordModal**

Match SettingsModal overlay patterns (fixed inset, backdrop, rounded-2xl, CSS vars). Full component:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";
import { useToast } from "@/components/Toast";
import { MIN_PASSWORD_LENGTH } from "@/server/services/auth-password";

// NOTE: MIN_PASSWORD_LENGTH is a pure const export — safe to import in client.
// If bundler complains about server barrel pollution, duplicate `const MIN = 8` locally.

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({
  open,
  onClose,
}: ChangePasswordModalProps) {
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
      setError("");
    }
    wasOpen.current = open;
  }, [open]);

  if (!open) return null;

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  } as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!oldPassword || !newPassword) {
      setError("请填写旧密码和新密码");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`);
      return;
    }
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPassword === oldPassword) {
      setError("新密码不能与旧密码相同");
      return;
    }

    setSaving(true);
    try {
      await apiJson("/api/auth/change-password", {
        method: "POST",
        ...jsonBody({ oldPassword, newPassword }),
      });
      toast("密码已修改", "success");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "修改失败");
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl p-5"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            修改密码
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {(
            [
              ["旧密码", oldPassword, setOldPassword, "current-password"],
              ["新密码", newPassword, setNewPassword, "new-password"],
              ["确认新密码", confirm, setConfirm, "new-password"],
            ] as const
          ).map(([label, value, setter, autoComplete]) => (
            <div key={label} className="space-y-1">
              <label
                className="text-[11px] font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                {label}
              </label>
              <input
                type="password"
                value={value}
                onChange={(e) => setter(e.target.value)}
                autoComplete={autoComplete}
                className="w-full rounded-xl px-3 py-2 text-sm"
                style={inputStyle}
              />
            </div>
          ))}

          {error && (
            <p className="text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-40"
              style={{
                background: "var(--accent-surface)",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
              }}
            >
              {saving ? "提交中…" : "确认修改"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

If Next client bundle errors on importing from `@/server/services/auth-password`, **do not** re-export server DB code — instead define `const MIN_PASSWORD_LENGTH = 8` at top of the modal file and keep the server constant as source of truth for APIs.

- [ ] **Step 2: Wire UserMenu**

In `src/components/Header/UserMenu.tsx`:

1. Import `ChangePasswordModal`.
2. Add `const [pwOpen, setPwOpen] = useState(false);`
3. Insert menu button **above** 退出登录 (after admin block):

```tsx
          <button
            onClick={() => {
              setOpen(false);
              setPwOpen(true);
            }}
            className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            🔑 修改密码
          </button>
```

4. After the relative menu wrapper (or as sibling inside the outer `div.relative`), render:

```tsx
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
```

Modal should stay mounted even when dropdown closes (`pwOpen` independent of `open`).

- [ ] **Step 3: Smoke in browser**

- Open UserMenu → 修改密码 → wrong old → error text.
- Correct flow → toast「密码已修改」, modal closes.

- [ ] **Step 4: Commit**

```bash
git add src/components/Auth/ChangePasswordModal.tsx src/components/Header/UserMenu.tsx
git commit -m "$(cat <<'EOF'
feat: add change-password modal to user menu

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Admin reset-password API

**Files:**
- Create: `src/app/api/admin/users/[id]/reset-password/route.ts`

**Interfaces:**
- Consumes: `requireAdmin` from `@/server/auth`; `adminResetPassword`; `handleRoute`, `readJson`, `jsonOk`, `ApiError`
- Produces: `POST` with context `params: Promise<{ id: string }>` (Next 16 style — match sibling routes under `users/[id]/`)

- [ ] **Step 1: Check sibling dynamic route signature**

Open `src/app/api/admin/users/[id]/conversations/route.ts` and **copy the same** `context` / `params` typing pattern (async `params` vs sync).

- [ ] **Step 2: Implement route**

Example matching Next 16 async params (adjust if siblings differ):

```ts
import { requireAdmin } from "@/server/auth";
import { ApiError, handleRoute, jsonOk, readJson } from "@/server/http";
import { adminResetPassword } from "@/server/services/auth-password";

export const POST = handleRoute(
  async (
    req: Request,
    context: { params: Promise<{ id: string }> },
  ) => {
    requireAdmin(req);
    const { id } = await context.params;
    if (!id) throw new ApiError("缺少用户 id", 400);

    const body = await readJson<{ password?: string; generate?: boolean }>(req);

    if (!body.generate && !body.password) {
      throw new ApiError("请提供 password 或 generate: true", 400);
    }

    const result = await adminResetPassword(id, {
      password: body.password,
      generate: body.generate === true,
    });

    return jsonOk({
      success: true,
      username: result.username,
      ...(result.temporaryPassword
        ? { temporaryPassword: result.temporaryPassword }
        : {}),
    });
  },
);
```

Middleware already blocks non-admin from `/api/admin/*`; `requireAdmin` is defense-in-depth (and fails if headers missing).

- [ ] **Step 3: Curl checks**

As admin cookie:

```bash
# generate
curl -s -X POST "http://localhost:3000/api/admin/users/USER_UUID/reset-password" \
  -H "Content-Type: application/json" \
  -H "Cookie: token=ADMIN_TOKEN" \
  -d '{"generate":true}'
```

Expected: `success`, `username`, `temporaryPassword` length 12.

```bash
# hand-set — must NOT echo password
curl -s -X POST "http://localhost:3000/api/admin/users/USER_UUID/reset-password" \
  -H "Content-Type: application/json" \
  -H "Cookie: token=ADMIN_TOKEN" \
  -d '{"password":"handset99"}'
```

Expected: `{ "success": true, "username": "..." }` without password field.

As non-admin token → 403.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/[id]/reset-password/route.ts
git commit -m "$(cat <<'EOF'
feat: add admin reset-password API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Admin ResetPasswordModal + page wire-up

**Files:**
- Create: `src/components/Admin/ResetPasswordModal.tsx`
- Modify: `src/app/admin/page.tsx` (selected user header area — add「重置密码」button)

**Interfaces:**
- Consumes: `apiJson` / `jsonBody`; selected `AdminUser`
- Produces: modal props `{ open; onClose; user: { id: string; username: string } | null }`

- [ ] **Step 1: Create ResetPasswordModal**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";

const MIN = 8;

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  user: { id: string; username: string } | null;
}

export default function ResetPasswordModal({
  open,
  onClose,
  user,
}: ResetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tempShown, setTempShown] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setPassword("");
      setConfirm("");
      setError("");
      setTempShown(null);
    }
    wasOpen.current = open;
  }, [open]);

  if (!open || !user) return null;

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  } as const;

  async function handSet(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN) {
      setError(`密码至少需要 ${MIN} 个字符`);
      return;
    }
    if (password !== confirm) {
      setError("两次输入不一致");
      return;
    }
    setSaving(true);
    try {
      await apiJson(`/api/admin/users/${user!.id}/reset-password`, {
        method: "POST",
        ...jsonBody({ password }),
      });
      setTempShown(null);
      setError("");
      alert(`已重置用户 ${user!.username} 的密码（请自行告知用户）`);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "重置失败");
    }
    setSaving(false);
  }

  async function generate() {
    setError("");
    setSaving(true);
    try {
      const data = await apiJson<{
        success: boolean;
        temporaryPassword?: string;
      }>(`/api/admin/users/${user!.id}/reset-password`, {
        method: "POST",
        ...jsonBody({ generate: true }),
      });
      if (!data.temporaryPassword) {
        setError("未返回临时密码");
      } else {
        setTempShown(data.temporaryPassword);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败");
    }
    setSaving(false);
  }

  async function copyTemp() {
    if (!tempShown) return;
    try {
      await navigator.clipboard.writeText(tempShown);
      alert("已复制到剪贴板");
    } catch {
      alert("复制失败，请手动选中复制");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-[24rem] max-w-[calc(100vw-2rem)] rounded-2xl border p-5 space-y-3"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            重置密码 · {user.username}
          </h2>
          <button type="button" onClick={onClose} style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          请妥善告知用户新密码；生成的临时密码仅显示一次。
        </p>

        {tempShown ? (
          <div className="space-y-2">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              临时密码（仅此一次）:
            </p>
            <code
              className="block w-full rounded-lg px-3 py-2 text-sm font-mono select-all"
              style={{ background: "var(--bg-root)", border: "1px solid var(--border)" }}
            >
              {tempShown}
            </code>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={copyTemp}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: "var(--accent-surface)",
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
                }}
              >
                复制
              </button>
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs">
                关闭
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handSet} className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="新密码（≥8）"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="确认新密码"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
              <div className="flex flex-wrap gap-2 justify-between pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={generate}
                  className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                  style={{
                    background: "var(--bg-root)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  生成随机密码
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                  style={{
                    background: "var(--accent-surface)",
                    border: "1px solid var(--accent)",
                    color: "var(--accent)",
                  }}
                >
                  {saving ? "处理中…" : "确认手填重置"}
                </button>
              </div>
            </form>
          </>
        )}

        {error && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire admin page**

In `src/app/admin/page.tsx`:

1. Import `ResetPasswordModal`.
2. State: `const [resetOpen, setResetOpen] = useState(false);`
3. In the selected-user header block (near username `h1`), add:

```tsx
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                🔑 重置密码
              </button>
```

4. At end of page JSX (inside outer flex container):

```tsx
      <ResetPasswordModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        user={
          selectedUser
            ? { id: selectedUser.id, username: selectedUser.username }
            : null
        }
      />
```

- [ ] **Step 3: Browser smoke**

Admin → select user → 重置密码 → generate → see temp once → copy → login as that user with temp works. Hand-set path works without echo.

- [ ] **Step 4: Commit**

```bash
git add src/components/Admin/ResetPasswordModal.tsx src/app/admin/page.tsx
git commit -m "$(cat <<'EOF'
feat: admin UI for password reset (hand-set + generate)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Login page forgot-password hint

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Add hint under the form (login tab only is fine; or always)**

After the `</form>` closing tag (still inside the card), add:

```tsx
        {tab === "login" && (
          <p
            className="mt-4 text-center text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            忘记密码？请联系管理员重置
          </p>
        )}
```

- [ ] **Step 2: Visual check** — login tab shows gray line; no new route.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "$(cat <<'EOF'
feat: show contact-admin hint for forgotten passwords

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: End-to-end manual verification + typecheck

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
cd "D:/工作/深焙-app"
node node_modules/typescript/bin/tsc --noEmit
```

Expected: EXIT 0.

- [ ] **Step 2: Re-run pure unit tests**

```bash
node --import tsx --test src/server/services/auth-password.test.ts
```

- [ ] **Step 3: Spec checklist (manual)**

| # | Scenario | Expect |
|---|----------|--------|
| 1 | change-password wrong old | 401, DB hash unchanged |
| 2 | change-password new &lt; 8 | 400 |
| 3 | change-password success | new login works, old fails |
| 4 | non-admin reset | 403 |
| 5 | admin generate | `temporaryPassword` returned, login works |
| 6 | admin hand-set | no password in JSON, login works |
| 7 | register password 7 chars | 400 |
| 8 | unauthenticated change-password | 401 |
| 9 | login page | 「忘记密码？请联系管理员重置」 visible |
| 10 | UserMenu | 「修改密码」 opens modal |

- [ ] **Step 4: Update spec status line (optional)**

In `docs/superpowers/specs/2026-07-29-password-change-and-admin-reset-design.md`, set status to「已实现」if all rows pass — only if you are also committing docs; otherwise skip.

- [ ] **Step 5: Final commit only if docs/status changed**; otherwise no empty commit.

---

## Self-review (plan vs spec)

| Spec section | Task coverage |
|--------------|---------------|
| 4.1 change-password API | Task 3 (+ service Task 1) |
| 4.2 admin reset API | Task 5 |
| 4.3 register ≥8 | Task 2 |
| 5.1 UserMenu + modal | Task 4 |
| 5.2 Admin reset UI | Task 6 |
| 5.3 Login hint | Task 7 |
| 6 service layer | Task 1 |
| 7 security (old pwd, admin only, no log) | Tasks 1/3/5 |
| 8 test matrix | Task 8 + pure tests Task 1 |
| Middleware auth bypass for `/api/auth/*` | Explicit in Task 3 (cookie verify) — **spec §4.1 said middleware headers; plan corrects implementation to match real middleware** |

**Placeholder scan:** none intentional; curl tokens are placeholders the implementer replaces.

**Type consistency:** `changeOwnPassword(userId, old, new)`, `adminResetPassword(id, { password?, generate? })`, response shapes match UI callers.

**Out of scope preserved:** no email, no force re-login, no session table, no schema change.
