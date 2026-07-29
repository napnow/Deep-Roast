# Login Split-Atelier + Image De-Emoji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/login` as a split-atelier brand stage + form, and strip emoji from image-gen toolbar/style presets without changing auth or generation logic.

**Architecture:** Pure UI in `login/page.tsx` (flex split, `md:` left panel, mobile form-first). Data cleanup in `IMAGE_STYLE_PRESETS` (drop `icon`) and label-only chips in `ImageInputColumn`. Reuse existing CSS variables and `font-display`; no new auth APIs.

**Tech Stack:** Next.js App Router, React client components, Tailwind utility classes, existing design tokens in `globals.css`.

## Global Constraints

- Do not change `login` / `register` / `AdminContactModal` behavior or API contracts.
- Success still uses `window.location.href = "/"`.
- Left brand stage uses fixed deep-roast dark colors even if app theme is light; right form follows theme tokens.
- Mobile (`< md` / 768px): hide left stage; top mark + full form only.
- No particle systems, no new animation libraries.
- Image presets: remove `icon` field; prompts/labels unchanged.
- Toolbar: no 🔧📷🖼️; text labels only.
- Do not change `EXAMPLE_PROMPTS` in this plan.
- No API/auth/backend file edits.

---

### Task 1: Image style presets + toolbar de-emoji

**Files:**
- Modify: `src/types/index.ts` (`IMAGE_STYLE_PRESETS`)
- Modify: `src/components/ImageGen/ImageInputColumn.tsx`

**Interfaces:**
- Consumes: existing `IMAGE_STYLE_PRESETS` shape used by ImageInputColumn
- Produces: `{ label: string; prompt: string }[]` without `icon`

- [ ] **Step 1: Update IMAGE_STYLE_PRESETS**

In `src/types/index.ts`, replace the presets block with:

```ts
export const IMAGE_STYLE_PRESETS = [
  { label: "无预设", prompt: "" },
  { label: "写实摄影", prompt: "超写实摄影风格，自然光，高细节，8K超清，专业构图" },
  { label: "日系动漫", prompt: "日系动漫风格，新海诚画风，柔和光影，治愈系，高精细度" },
  { label: "油画艺术", prompt: "古典油画风格，厚涂笔触，丰富色彩层次，大师级光影" },
  { label: "电影级", prompt: "电影级画质，cinematic lighting，景深效果，16:9宽银幕质感" },
];
```

- [ ] **Step 2: Update ImageInputColumn toolbar + chips**

Toolbar row: remove 🔧 span (or replace with muted text `工具` if a label is needed — prefer remove). Buttons text:

- `反推提示词` (or short `反推` — use `反推`)
- `图生图`

Preset buttons: render only `{preset.label}` — delete `<span>{preset.icon}</span>`.

- [ ] **Step 3: Grep verify no icon on presets**

Run: `rg "preset\.icon|🔧|📷|🖼️" src/components/ImageGen src/types/index.ts`  
Expected: no matches for those emoji/icon usages in image gen path.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/components/ImageGen/ImageInputColumn.tsx
git commit -m "ui: remove emoji from image gen presets and toolbar"
```

---

### Task 2: Login split-atelier page

**Files:**
- Modify: `src/app/login/page.tsx` (full rewrite of JSX shell; keep state + handleSubmit)

**Interfaces:**
- Consumes: `login`, `register` from `@/lib/auth-client`; `AdminContactModal`
- Produces: same page route UX with split layout

- [ ] **Step 1: Rewrite login page layout**

Keep all state and `handleSubmit` identical. Replace return JSX with:

**Structure:**
```tsx
<div className="min-h-screen flex flex-col md:flex-row">
  {/* Left: hidden on mobile, flex-1 on md+ ; fixed dark atelier */}
  <aside className="hidden md:flex md:w-[46%] ...">...</aside>
  {/* Right: form column */}
  <main className="flex-1 flex flex-col ...">
    {/* mobile-only top brand */}
    <div className="md:hidden">...</div>
    <div className="flex-1 flex items-center justify-center p-6">
      {/* form card content: tabs, error, form, contact */}
    </div>
  </main>
</div>
```

**Left panel content (dark fixed):**
- Background: `#0a0806` or `html.dark` token equivalents hardcoded for ritual entry: e.g. `background: "#0a0806"`, text cream
- glow-spot overlay
- 「焙」 mark gradient
- Title 深焙 + Deep Roast
- Tagline: 深度思考，慢焙出好答案
- Up to 3 micro bullets, pure text, e.g.:
  - 文生文 · 深度推理
  - 文生图 · 慢火出图
  - 积分可控 · 自托管友好

**Right panel:**
- `background: var(--bg-root)`
- Form max-width ~24rem, `animate-fade-up`
- Same tab/error/inputs/submit/contact as current
- No giant ☕

**Mobile top:**
- Small 焙 + 深焙 row, then form

Full implementation should be one complete `page.tsx` file preserving handlers.

- [ ] **Step 2: Manual sanity**

- Desktop: two columns visible  
- Narrow: left gone, top brand + form  
- Login/register still call same functions  

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`  
Expected: EXIT 0

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "ui: split-atelier login page with mobile form-first"
```

---

### Task 3: Plan + verify

**Files:** none new required

- [ ] **Step 1: Build**

Run: `npx next build` (or at least `tsc`)  
Expected: success

- [ ] **Step 2: Spec checklist**

Confirm against `docs/superpowers/specs/2026-07-29-login-split-atelier-and-image-deemoji-design.md` acceptance items.

---

## Self-Review

1. Spec coverage: login split + mobile + de-emoji + non-goals noted — covered by Task 1–2.  
2. No placeholders in steps.  
3. Preset shape consistent after icon removal.
