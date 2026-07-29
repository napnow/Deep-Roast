# Admin Contact on Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let unauthenticated users open a small modal on the login page to see admin-configured contact text and optional group QR image; admins edit both in `/admin` site settings.

**Architecture:** Single-row `site_settings` table (like `llm_config`). Public `GET /api/public/admin-contact` (middleware bypass). Admin GET/PUT + multipart image upload under `/api/admin/site-settings*`. Login modal fetches public API; AdminDashboard hosts the editor card.

**Tech Stack:** Next.js 16 App Router, Drizzle + Postgres, Node `fs/promises`, existing `handleRoute` / `requireAdmin` / `apiJson`.

## Global Constraints

- Free-text contact + optional image (png/jpeg/webp, ≤ **2MB**).
- Image dir: `public/uploads/admin-contact/`; path stored like `/uploads/admin-contact/<file>`.
- Public read unauthenticated; writes admin-only.
- Text rendered with `whitespace-pre-wrap` only (no HTML).
- Empty config: 200 + empty text + null imageUrl; UI empty-state copy in Chinese.
- Middleware must allow `/api/public/*` before auth check.
- No test framework: use `node --test` for pure helpers if any; otherwise curl + tsc.

---

## File map

| Path | Role |
|------|------|
| `src/db/schema.ts` | `siteSettings` table |
| `drizzle/0001_site_settings.sql` (or run SQL) | CREATE TABLE |
| `src/middleware.ts` | bypass `/api/public/` |
| `src/server/services/site-settings.ts` | get/update/upload/clear |
| `src/app/api/public/admin-contact/route.ts` | public GET |
| `src/app/api/admin/site-settings/route.ts` | admin GET/PUT |
| `src/app/api/admin/site-settings/contact-image/route.ts` | admin POST multipart |
| `src/components/Auth/AdminContactModal.tsx` | login modal |
| `src/app/login/page.tsx` | link + modal |
| `src/components/Admin/AdminSiteSettingsCard.tsx` | editor UI |
| `src/components/Admin/AdminDashboard.tsx` | mount card |
| `src/app/admin/page.tsx` | pass props if needed |

---

### Task 1: Schema + DB table

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0001_site_settings.sql` (SQL for apply)

**Produces:** `siteSettings` export; table exists in Postgres.

- [ ] **Step 1: Add schema**

After `llmConfig` block in `src/db/schema.ts`, add:

```ts
// ── Site settings (single row) ──
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    adminContactText: text("admin_contact_text").notNull().default(""),
    adminContactImagePath: text("admin_contact_image_path")
      .notNull()
      .default(""),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    singleRowCheck: check("site_settings_single_row", sql`${table.id} = 1`),
  }),
);
```

- [ ] **Step 2: SQL file**

Create `drizzle/0001_site_settings.sql`:

```sql
CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "admin_contact_text" text NOT NULL DEFAULT '',
  "admin_contact_image_path" text NOT NULL DEFAULT '',
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "site_settings_single_row" CHECK ("id" = 1)
);

INSERT INTO "site_settings" ("id") VALUES (1)
ON CONFLICT ("id") DO NOTHING;
```

- [ ] **Step 3: Apply to local DB**

```bash
cd "D:/工作/深焙-app"
# Use psql or node; example with docker if available:
# docker exec -i <postgres_container> psql -U admin -d mydb < drizzle/0001_site_settings.sql
# Or:
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const sql = fs.readFileSync('drizzle/0001_site_settings.sql','utf8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://admin:admin123@localhost:5432/mydb' });
pool.query(sql).then(() => { console.log('OK'); return pool.end(); }).catch(e => { console.error(e); process.exit(1); });
"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/0001_site_settings.sql
git commit -m "feat: add site_settings table for admin contact"
```

---

### Task 2: Middleware public bypass + site-settings service

**Files:**
- Modify: `src/middleware.ts`
- Create: `src/server/services/site-settings.ts`

**Produces:**
- `getSiteSettings()`, `getPublicAdminContact()`, `updateAdminContactText(text)`, `clearAdminContactImage()`, `saveAdminContactImage(buffer, mime)`

- [ ] **Step 1: Middleware**

At top of middleware handler, with auth bypass:

```ts
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/public/")) {
    return NextResponse.next();
  }
```

- [ ] **Step 2: Service implementation**

```ts
import { eq } from "drizzle-orm";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { ApiError } from "@/server/http";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "admin-contact");
const PUBLIC_PREFIX = "/uploads/admin-contact";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

async function ensureRow() {
  const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  const [row] = await db.insert(siteSettings).values({ id: 1 }).returning();
  return row!;
}

export async function getSiteSettings() {
  const row = await ensureRow();
  return {
    adminContactText: row.adminContactText ?? "",
    adminContactImagePath: row.adminContactImagePath ?? "",
    updatedAt: row.updatedAt,
  };
}

export async function getPublicAdminContact() {
  const s = await getSiteSettings();
  return {
    text: s.adminContactText,
    imageUrl: s.adminContactImagePath ? s.adminContactImagePath : null,
  };
}

export async function updateAdminContactText(text: string) {
  await ensureRow();
  const [row] = await db
    .update(siteSettings)
    .set({ adminContactText: text, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  return {
    adminContactText: row!.adminContactText,
    adminContactImagePath: row!.adminContactImagePath,
    updatedAt: row!.updatedAt,
  };
}

export async function clearAdminContactImage() {
  const s = await getSiteSettings();
  if (s.adminContactImagePath) {
    const rel = s.adminContactImagePath.replace(/^\//, "");
    const full = path.join(process.cwd(), "public", rel.replace(/^uploads\//, "uploads/"));
    // safer: path under UPLOAD_DIR only
    const base = path.basename(s.adminContactImagePath);
    const candidate = path.join(UPLOAD_DIR, base);
    try {
      await unlink(candidate);
    } catch {
      /* ignore missing */
    }
  }
  const [row] = await db
    .update(siteSettings)
    .set({ adminContactImagePath: "", updatedAt: new Date() })
    .where(eq(siteSettings.id, 1))
    .returning();
  return {
    adminContactText: row!.adminContactText,
    adminContactImagePath: row!.adminContactImagePath,
    updatedAt: row!.updatedAt,
  };
}

export async function saveAdminContactImage(
  data: Buffer,
  mime: string,
): Promise<{ adminContactImagePath: string }> {
  const ext = ALLOWED[mime];
  if (!ext) throw new ApiError("仅支持 PNG / JPEG / WebP 图片", 400);
  if (data.byteLength > MAX_BYTES) {
    throw new ApiError("图片不能超过 2MB", 400);
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  // remove previous
  const prev = await getSiteSettings();
  if (prev.adminContactImagePath) {
    const base = path.basename(prev.adminContactImagePath);
    try {
      await unlink(path.join(UPLOAD_DIR, base));
    } catch {
      /* ignore */
    }
  }

  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), data);
  const publicPath = `${PUBLIC_PREFIX}/${filename}`;

  await db
    .update(siteSettings)
    .set({ adminContactImagePath: publicPath, updatedAt: new Date() })
    .where(eq(siteSettings.id, 1));

  return { adminContactImagePath: publicPath };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts src/server/services/site-settings.ts
git commit -m "feat: site-settings service and public API middleware bypass"
```

---

### Task 3: API routes

**Files:**
- Create: `src/app/api/public/admin-contact/route.ts`
- Create: `src/app/api/admin/site-settings/route.ts`
- Create: `src/app/api/admin/site-settings/contact-image/route.ts`

- [ ] **Step 1: Public GET**

```ts
import { handleRoute, jsonOk } from "@/server/http";
import { getPublicAdminContact } from "@/server/services/site-settings";

export const GET = handleRoute(async () => {
  return jsonOk(await getPublicAdminContact());
});
```

- [ ] **Step 2: Admin GET/PUT**

```ts
import { requireAdmin } from "@/server/auth";
import { handleRoute, jsonOk, readJson } from "@/server/http";
import {
  clearAdminContactImage,
  getSiteSettings,
  updateAdminContactText,
} from "@/server/services/site-settings";

export const GET = handleRoute(async (req) => {
  requireAdmin(req);
  return jsonOk(await getSiteSettings());
});

export const PUT = handleRoute(async (req) => {
  requireAdmin(req);
  const body = await readJson<{
    adminContactText?: string;
    clearImage?: boolean;
  }>(req);

  if (body.clearImage === true) {
    await clearAdminContactImage();
  }
  if (typeof body.adminContactText === "string") {
    return jsonOk(await updateAdminContactText(body.adminContactText));
  }
  return jsonOk(await getSiteSettings());
});
```

- [ ] **Step 3: Upload**

```ts
import { requireAdmin } from "@/server/auth";
import { ApiError, handleRoute, jsonOk } from "@/server/http";
import { saveAdminContactImage } from "@/server/services/site-settings";

export const POST = handleRoute(async (req) => {
  requireAdmin(req);
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    throw new ApiError("请选择图片文件（字段名 file）", 400);
  }
  const mime = file.type || "";
  const buf = Buffer.from(await file.arrayBuffer());
  return jsonOk(await saveAdminContactImage(buf, mime));
});
```

- [ ] **Step 4: Curl smoke**

```bash
curl -s http://localhost:3000/api/public/admin-contact
# expect {"text":"","imageUrl":null}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/public/admin-contact/route.ts src/app/api/admin/site-settings/
git commit -m "feat: public and admin APIs for admin contact settings"
```

---

### Task 4: Login AdminContactModal

**Files:**
- Create: `src/components/Auth/AdminContactModal.tsx`
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Modal component**

```tsx
"use client";

import { useEffect, useState } from "react";

interface AdminContactModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminContactModal({ open, onClose }: AdminContactModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    fetch("/api/public/admin-contact")
      .then(async (res) => {
        if (!res.ok) throw new Error("获取失败");
        return res.json();
      })
      .then((data: { text?: string; imageUrl?: string | null }) => {
        setText(data.text || "");
        setImageUrl(data.imageUrl || null);
      })
      .catch(() => setError("获取失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const empty = !loading && !error && !text.trim() && !imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border p-5 space-y-3"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            联系管理员
          </h2>
          <button type="button" onClick={onClose} style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>
        {loading && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>加载中…</p>
        )}
        {error && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        {empty && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            管理员暂未填写联系方式，请稍后再试或通过其他渠道联系。
          </p>
        )}
        {!loading && !error && text.trim() && (
          <p
            className="text-sm whitespace-pre-wrap break-words"
            style={{ color: "var(--text-secondary)" }}
          >
            {text}
          </p>
        )}
        {!loading && !error && imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="交流群"
            className="mx-auto max-w-[14rem] w-full rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire login page**

Replace static paragraph with:

```tsx
        {tab === "login" && (
          <>
            <p
              className="mt-4 text-center text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              忘记密码？{" "}
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="underline font-medium"
                style={{ color: "var(--accent)" }}
              >
                联系管理员
              </button>
            </p>
            <AdminContactModal
              open={contactOpen}
              onClose={() => setContactOpen(false)}
            />
          </>
        )}
```

Add `const [contactOpen, setContactOpen] = useState(false);` and import modal.

- [ ] **Step 3: Commit**

```bash
git add src/components/Auth/AdminContactModal.tsx src/app/login/page.tsx
git commit -m "feat: login modal for admin contact info"
```

---

### Task 5: Admin site settings UI

**Files:**
- Create: `src/components/Admin/AdminSiteSettingsCard.tsx`
- Modify: `src/components/Admin/AdminDashboard.tsx` — render card below stats
- Modify: `src/app/admin/page.tsx` only if dashboard needs extra props (prefer self-contained card that fetches itself)

**Produces:** Self-contained card that loads GET settings, saves PUT, uploads POST file.

- [ ] **Step 1: AdminSiteSettingsCard**

```tsx
"use client";

import { useEffect, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";

export default function AdminSiteSettingsCard() {
  const [text, setText] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<{
        adminContactText: string;
        adminContactImagePath: string;
      }>("/api/admin/site-settings");
      setText(data.adminContactText || "");
      setImagePath(data.adminContactImagePath || "");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "加载失败");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveText() {
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{
        adminContactText: string;
        adminContactImagePath: string;
      }>("/api/admin/site-settings", {
        method: "PUT",
        ...jsonBody({ adminContactText: text }),
      });
      setText(data.adminContactText);
      setImagePath(data.adminContactImagePath);
      setMsg("✓ 文案已保存");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    }
    setSaving(false);
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setSaving(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/site-settings/contact-image", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      setImagePath(data.adminContactImagePath || "");
      setMsg("✓ 图片已更新");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "上传失败");
    }
    setSaving(false);
  }

  async function clearImage() {
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{
        adminContactText: string;
        adminContactImagePath: string;
      }>("/api/admin/site-settings", {
        method: "PUT",
        ...jsonBody({ clearImage: true }),
      });
      setImagePath(data.adminContactImagePath || "");
      setMsg("✓ 已清除图片");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "清除失败");
    }
    setSaving(false);
  }

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  } as const;

  return (
    <div
      className="rounded-xl border p-4 text-left space-y-3"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
        📞 站点设置 · 联系方式
      </p>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        展示在登录页「联系管理员」弹层；可填微信/邮箱说明，并上传交流群二维码。
      </p>
      {loading ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>加载中…</p>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="例如：微信 xxx / 工作日 10:00–18:00 处理重置密码"
            className="w-full rounded-lg px-3 py-2 text-xs resize-y"
            style={inputStyle}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={saving}
              onClick={saveText}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{
                background: "var(--accent-surface)",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
              }}
            >
              {saving ? "处理中…" : "保存文案"}
            </button>
            <label className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              上传图片
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onUpload(e.target.files?.[0] || null)}
              />
            </label>
            {imagePath && (
              <button
                type="button"
                disabled={saving}
                onClick={clearImage}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ color: "var(--danger)" }}
              >
                清除图片
              </button>
            )}
          </div>
          {imagePath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePath}
              alt="当前交流群图"
              className="max-w-[10rem] rounded-lg border"
              style={{ borderColor: "var(--border)" }}
            />
          )}
          {msg && (
            <p className="text-[11px]" style={{ color: msg.startsWith("✓") ? "var(--success)" : "var(--danger)" }}>
              {msg}
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount on AdminDashboard**

Import and place below the stats grid (still inside the max-w container), so it shows when no user selected:

```tsx
import AdminSiteSettingsCard from "@/components/Admin/AdminSiteSettingsCard";
// ...
        <AdminSiteSettingsCard />
```

When `globalStats` is null, still show the card (or show card even during stats load). Prefer: always render card under overview; if stats loading, show loading for stats only.

Simplest: change dashboard so when !globalStats, still show SiteSettingsCard + loading stats message.

- [ ] **Step 3: Commit**

```bash
git add src/components/Admin/AdminSiteSettingsCard.tsx src/components/Admin/AdminDashboard.tsx
git commit -m "feat: admin UI to edit contact text and QR image"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1:** `node node_modules/typescript/bin/tsc --noEmit` → EXIT 0
- [ ] **Step 2:** Curl matrix from spec §8
- [ ] **Step 3:** Browser: login → 联系管理员; admin → save text + upload image → re-open login modal

No commit unless fixes needed.

---

## Spec coverage

| Spec | Task |
|------|------|
| site_settings table | 1 |
| middleware public | 2 |
| service + upload | 2 |
| public/admin APIs | 3 |
| login modal | 4 |
| admin editor | 5 |
| test matrix | 6 |

## Type consistency

- Public: `{ text, imageUrl }`
- Admin settings: `{ adminContactText, adminContactImagePath, updatedAt? }`
- Upload field name: **`file`**
- Upload response: `{ adminContactImagePath }`
