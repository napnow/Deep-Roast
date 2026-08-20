# Deep Roast Workspace UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the authenticated Deep Roast experience around a desktop-first image creation studio, a separate conversation workspace, and a clearly partitioned admin console, while preserving existing business behavior except for the approved admin API-key management extension.

**Architecture:** Keep the existing Next.js App Router page, Zustand store, hooks, and service layer, but split the UI into focused workspace and admin components. Add pure helper modules for state transitions, filtering, grouping, and error classification so behavior can be developed with `node:test`; keep visual components as client components and validate them with lint, production builds, and viewport QA. Add only the minimum database columns and admin route handlers required for API-key administration and aggregate usage.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, TypeScript 5, Tailwind CSS 4 plus global design tokens, Zustand 5, Drizzle ORM 0.45, PostgreSQL, Node 24 test runner with `tsx`.

## Global Constraints

- Read the relevant guides in `node_modules/next/dist/docs/` before changing App Router, Route Handler, client-boundary, or CSS behavior.
- Desktop web is primary; explicitly verify 1440px, 1280px, and 1024px widths.
- Mobile must retain generation, result viewing, download, history, and conversation basics.
- Preserve the existing stone, charcoal, caramel, Fraunces, and Manrope visual direction.
- Image creation is the default and primary workspace; chat remains secondary.
- Preserve existing APIs and backend behavior except for approved admin API-key management and aggregate usage fields.
- Preserve the user's existing uncommitted work; stage and commit only files owned by the current task.
- Do not add a component library or icon dependency; use a small repository-owned SVG icon set.
- Do not persist reference-image base64 data or plaintext API keys to localStorage.
- Existing API-key plaintext is never recoverable; a newly created key is shown once.
- Every task ends with focused tests, lint/build verification proportional to the change, and a scoped commit.

---

### Task 1: Restore the Build Baseline and Establish Shared UI Primitives

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/ui/icons.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `AppIconName` and `AppIcon({ name, size, className })` for all later workspace and admin tasks.
- Produces: shared CSS classes `.ui-button`, `.ui-button--primary`, `.ui-button--danger`, `.ui-icon-button`, `.ui-field`, `.ui-panel`, `.ui-kicker`.

- [ ] **Step 1: Reproduce the current build failure**

Run:

```powershell
npm.cmd run build
```

Expected: FAIL at `src/components/ImageGen/ImageResultPanel.tsx` because `thinking-orbs` is declared in `package.json` but absent from the current lockfile/install.

- [ ] **Step 2: Synchronize the dependency lockfile**

Run:

```powershell
npm.cmd install
```

Expected: `package-lock.json` contains `thinking-orbs`, and `node_modules/thinking-orbs` exists.

- [ ] **Step 3: Add a stable test command**

Update the scripts block in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "node --import tsx --test src/**/*.test.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx src/db/seed.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

Run:

```powershell
npm.cmd test
```

Expected: all currently discovered `src/**/*.test.ts` files pass.

- [ ] **Step 4: Create the repository-owned icon component**

Create `src/components/ui/icons.tsx` with this public API and an exhaustive SVG-path switch:

```tsx
import type { ReactNode, SVGProps } from "react";

export type AppIconName =
  | "menu"
  | "image"
  | "chat"
  | "history"
  | "details"
  | "download"
  | "copy"
  | "edit"
  | "search"
  | "more"
  | "wallet"
  | "announcement"
  | "key"
  | "settings"
  | "user"
  | "refresh"
  | "close"
  | "chevron-down"
  | "arrow-left"
  | "trash";

interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: AppIconName;
  size?: number;
}

export function AppIcon({ name, size = 16, ...props }: AppIconProps) {
  const paths: Record<AppIconName, ReactNode> = {
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="15.5" cy="8.5" r="1.5" /></>,
    chat: <path d="M4 5h16v11H8l-4 3V5Z" />,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    details: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 19h16" />,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    edit: <path d="m4 20 4.5-1 10-10a2 2 0 0 0-3-3l-10 10L4 20Z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" /><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" /></>,
    announcement: <><path d="m4 13 2 6h3l-1-6M4 9v4h4l9 4V5L8 9H4Z" /><path d="M20 9v4" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8m-3 3 2 2m-5 1 2 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7-.8-1.9.9-1.9-2.1-2.1-1.9.9-1.9-.8-.7-2h-3l-.7 2-1.9.8-1.9-.9L2.9 6l.9 1.9L3 9.8l-2 .7v3l2 .7.8 1.9-.9 1.9L5 20.1l1.9-.9 1.9.8.7 2h3l.7-2 1.9-.8 1.9.9 2.1-2.1-.9-1.9.8-1.9 2-.7Z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5M6.1 8a7 7 0 0 1 11.5-1.7L20 9M4 15l2.4 2.7A7 7 0 0 0 18 16" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    "chevron-down": <path d="m6 9 6 6 6-6" />,
    "arrow-left": <path d="m15 18-6-6 6-6M9 12h11" />,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /><path d="M10 11v6M14 11v6" /></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {paths[name]}
    </svg>
  );
}
```

- [ ] **Step 5: Add the shared visual primitives**

Append shared classes to `src/app/globals.css`, using existing tokens rather than new colors:

```css
.ui-panel {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-surface);
}

.ui-button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 650;
  transition: background 180ms ease, border-color 180ms ease, color 180ms ease, transform 150ms ease;
}

.ui-button--primary { background: var(--accent); border-color: var(--accent); color: var(--accent-on); }
.ui-button--danger { background: var(--danger-surface); border-color: var(--danger); color: var(--danger); }
.ui-button:active:not(:disabled) { transform: scale(0.98); }
.ui-button:disabled { opacity: 0.4; cursor: not-allowed; }
.ui-icon-button { width: 36px; height: 36px; padding: 0; }
.ui-field { min-height: 40px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--bg-root); color: var(--text-primary); font-size: 0.875rem; }
.ui-kicker { color: var(--text-muted); font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
```

- [ ] **Step 6: Verify the baseline**

Run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; the build no longer reports `thinking-orbs` as missing.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json src/components/ui/icons.tsx src/app/globals.css
git commit -m "chore: establish workspace UI foundation"
```

### Task 2: Add Workspace Preferences, Draft State, and the Minimal App Shell

**Files:**
- Create: `src/lib/workspace-preferences.ts`
- Create: `src/lib/workspace-preferences.test.ts`
- Modify: `src/lib/store.ts`
- Create: `src/components/Workspace/AppShell.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Header/UserMenu.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: `WorkspaceMode`, `ImageCreationMode`, `InspectorTab`, `parseStoredWorkspaceMode`, `parseStoredBoolean`.
- Produces store setters `setImageCreationMode`, `setInspectorTab`, `setInspectorCollapsed`, `setActiveImageId`.
- Produces `AppShell({ header, children })` and a reduced `Header` with no model or standalone check-in controls.

- [ ] **Step 1: Write failing preference tests**

Create `src/lib/workspace-preferences.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseStoredBoolean, parseStoredWorkspaceMode } from "./workspace-preferences";

describe("workspace preferences", () => {
  it("accepts only supported workspace modes", () => {
    assert.equal(parseStoredWorkspaceMode("image"), "image");
    assert.equal(parseStoredWorkspaceMode("chat"), "chat");
    assert.equal(parseStoredWorkspaceMode("admin"), "image");
    assert.equal(parseStoredWorkspaceMode(null), "image");
  });

  it("parses persisted booleans without truthy string mistakes", () => {
    assert.equal(parseStoredBoolean("true", false), true);
    assert.equal(parseStoredBoolean("false", true), false);
    assert.equal(parseStoredBoolean(null, true), true);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```powershell
node --import tsx --test src/lib/workspace-preferences.test.ts
```

Expected: FAIL because `workspace-preferences.ts` does not exist.

- [ ] **Step 3: Implement preference parsing**

Create `src/lib/workspace-preferences.ts`:

```ts
export type WorkspaceMode = "image" | "chat";
export type ImageCreationMode = "text" | "edit" | "reverse";
export type InspectorTab = "history" | "details";

export function parseStoredWorkspaceMode(value: string | null): WorkspaceMode {
  return value === "chat" ? "chat" : "image";
}

export function parseStoredBoolean(value: string | null, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}
```

- [ ] **Step 4: Extend the Zustand UI state**

Add these fields and setters to `DeepRoastState` and its initializer in `src/lib/store.ts`:

```ts
imageCreationMode: ImageCreationMode;
inspectorTab: InspectorTab;
inspectorCollapsed: boolean;
activeImageId: string | null;
setImageCreationMode: (mode: ImageCreationMode) => void;
setInspectorTab: (tab: InspectorTab) => void;
setInspectorCollapsed: (collapsed: boolean) => void;
setActiveImageId: (id: string | null) => void;
```

Initialize with `"text"`, `"history"`, `false`, and `null`. Keep `activeMode` defaulted to `"image"`. Persist only `activeMode` and `inspectorCollapsed` from `src/app/page.tsx`; do not persist image references or prompts.

- [ ] **Step 5: Create the shell and simplify the header contract**

Create `src/components/Workspace/AppShell.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

export default function AppShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className="workspace-shell">
      {header}
      <main className="workspace-main">{children}</main>
    </div>
  );
}
```

Change `HeaderProps` to this smaller contract:

```ts
interface HeaderProps {
  activeMode: "image" | "chat";
  onModeChange: (mode: "image" | "chat") => void;
  username: string;
  role: string;
  credits: number;
  onWalletClick: () => void;
  onLogout: () => void;
  onMenuClick?: () => void;
}
```

Render only brand, the image/chat segmented switch, wallet balance, and `UserMenu`. Remove model selection and standalone check-in rendering from `Header`.

- [ ] **Step 6: Group the account menu**

Update `UserMenu` to render semantic group labels and repository SVG icons:

```tsx
<MenuGroup label="账户">修改密码、API 接入</MenuGroup>
<MenuGroup label="站点">公告、主题设置</MenuGroup>
{role === "admin" && <MenuGroup label="管理">管理控制台</MenuGroup>}
<MenuGroup>退出登录</MenuGroup>
```

Keep the existing modal state and navigation callbacks. Move wallet and check-in exclusively to `CreditWalletModal`; do not create another check-in action.

- [ ] **Step 7: Wire local preferences in the page**

In `src/app/page.tsx`, initialize the stored workspace mode only after mount, persist changes, derive `activeImage` from `activeImageId`, and wrap the page in `AppShell`. Use keys `deep-roast-workspace` and `deep-roast-inspector-collapsed`. Mount the image and chat workspace containers once and toggle their visibility with CSS plus `aria-hidden`/`inert`; do not conditionally unmount them. This preserves draft, scroll, and in-flight generation presentation while switching workspaces.

- [ ] **Step 8: Add shell CSS and verify**

Add:

```css
.workspace-shell { position: relative; z-index: 1; height: 100svh; display: flex; flex-direction: column; background: var(--bg-root); }
.workspace-main { flex: 1; min-height: 0; min-width: 0; display: flex; overflow: hidden; }
.workspace-topbar { min-height: 56px; border-bottom: 1px solid var(--border-strong); background: color-mix(in srgb, var(--bg-surface) 90%, transparent); backdrop-filter: blur(14px); }
```

Run:

```powershell
node --import tsx --test src/lib/workspace-preferences.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; the top bar contains no model selector or standalone sign-in button.

- [ ] **Step 9: Commit**

```powershell
git add src/lib/workspace-preferences.ts src/lib/workspace-preferences.test.ts src/lib/store.ts src/components/Workspace/AppShell.tsx src/components/Header.tsx src/components/Header/UserMenu.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: add focused workspace shell"
```

### Task 3: Build the Persistent Image Creation Panel

**Files:**
- Create: `src/lib/image-workspace.ts`
- Create: `src/lib/image-workspace.test.ts`
- Modify: `src/lib/store.ts`
- Create: `src/components/ImageGen/CreationPanel.tsx`
- Create: `src/components/ImageGen/TextToImageForm.tsx`
- Modify: `src/components/ImageGen/Img2ImgPanel.tsx`
- Modify: `src/components/ImageGen/ReversePromptPanel.tsx`
- Modify: `src/components/ImageGen/ImageGenView.tsx`
- Modify: `src/hooks/useImageActions.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `TextToImageDraft`, `ImageToImageDraft`, `ReversePromptDraft`, `DraftReference`, `generationCost`, `applyReversePrompt`.
- Produces store setters for each draft; draft data stays in memory only.
- Produces `CreationPanel` as the only desktop control column.

- [ ] **Step 1: Write failing draft and cost tests**

Create `src/lib/image-workspace.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyReversePrompt, generationCost } from "./image-workspace";

describe("image workspace", () => {
  it("computes image cost from count", () => {
    assert.equal(generationCost(1, 5), 5);
    assert.equal(generationCost(4, 5), 20);
  });

  it("clamps invalid counts", () => {
    assert.equal(generationCost(0, 5), 5);
    assert.equal(generationCost(99, 5), 25);
  });

  it("moves a reverse result into the text prompt without losing text settings", () => {
    const next = applyReversePrompt(
      { prompt: "old", size: "1024x1024", count: 3, stylePrompt: "cinematic" },
      "new prompt",
    );
    assert.deepEqual(next, { prompt: "new prompt", size: "1024x1024", count: 3, stylePrompt: "cinematic" });
  });
});
```

- [ ] **Step 2: Verify test failure**

Run:

```powershell
node --import tsx --test src/lib/image-workspace.test.ts
```

Expected: FAIL because `image-workspace.ts` does not exist.

- [ ] **Step 3: Implement draft types and helpers**

Create `src/lib/image-workspace.ts`:

```ts
export interface DraftReference { preview: string; base64: string; }
export interface TextToImageDraft { prompt: string; size: string; count: number; stylePrompt: string; }
export interface ImageToImageDraft { prompt: string; size: string; count: number; styleId: string; styleColor: string; styleTexture: string; refs: DraftReference[]; }
export interface ReversePromptDraft { image: string | null; resultPrompt: string; }

export function generationCost(count: number, perImage: number): number {
  const safeCount = Math.min(Math.max(Math.floor(count) || 1, 1), 5);
  return safeCount * perImage;
}

export function applyReversePrompt(draft: TextToImageDraft, prompt: string): TextToImageDraft {
  return { ...draft, prompt };
}
```

- [ ] **Step 4: Store drafts independently**

Add these store fields and setters:

```ts
textToImageDraft: TextToImageDraft;
imageToImageDraft: ImageToImageDraft;
reversePromptDraft: ReversePromptDraft;
setTextToImageDraft: (next: Partial<TextToImageDraft>) => void;
setImageToImageDraft: (next: Partial<ImageToImageDraft>) => void;
setReversePromptDraft: (next: Partial<ReversePromptDraft>) => void;
```

Initialize text and edit sizes from `"1024x1024"`, counts from `1`, strings empty, and refs as `[]`. Do not add these fields to localStorage.

- [ ] **Step 5: Create the creation panel**

Create `CreationPanel.tsx` with this contract:

```ts
interface CreationPanelProps {
  model: string;
  credits: number;
  isAdmin: boolean;
  generating: boolean;
  onGenerate: (prompt: string, size: string, count: number) => void;
  onEdit: (images: string[], prompt: string, size: string, count: number) => void;
  onStop: () => void;
}
```

Render a fixed segmented control for `text`, `edit`, and `reverse`, one mode form at a time, and a sticky footer. The footer must show cost and one primary action. Use existing `IMAGE_STYLE_PRESETS`, `getSizeOptions`, `Img2ImgPanel`, and `ReversePromptPanel`; move their input state to the store-backed drafts instead of duplicating local state.

- [ ] **Step 6: Create the text form and adapt edit/reverse forms**

`TextToImageForm` receives the text draft and renders prompt, style, ratio, count, and a `<details>` advanced section containing the current model. `Img2ImgPanel` receives `draft` and `onDraftChange`; `ReversePromptPanel` receives `draft`, `onDraftChange`, and `onUsePrompt`.

Use this reverse handoff:

```ts
function handleUseReversePrompt(prompt: string) {
  setTextToImageDraft(applyReversePrompt(textToImageDraft, prompt));
  setImageCreationMode("text");
}
```

- [ ] **Step 7: Honor text-generation count with existing APIs**

Add `handleGenerateImageBatch(prompt, size, count)` to `useImageActions`. Clamp `count` to 1–5, reuse one `AbortController`, issue the existing `/api/image` request sequentially for each requested image, collect successful records, prepend them to history once, refresh credits once, and stop immediately on insufficient credits. Do not add a new backend endpoint. Keep `handleGenerateImage(prompt, size)` as a one-image wrapper for compatibility.

The creation panel calls the batch action; its disabled state is based on prompt validity, available credits, and current generation state.

- [ ] **Step 8: Replace the desktop input column**

Update `ImageGenView.tsx` to render `CreationPanel`, the existing result panel temporarily, and the existing history panel. Keep mobile rendering unchanged in this task.

- [ ] **Step 9: Verify**

Run:

```powershell
node --import tsx --test src/lib/image-workspace.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; switching text/edit/reverse preserves each draft, text count 1–5 produces that many requests, and the primary action remains visible at the bottom of the left panel.

- [ ] **Step 10: Commit**

```powershell
git add src/lib/image-workspace.ts src/lib/image-workspace.test.ts src/lib/store.ts src/components/ImageGen/CreationPanel.tsx src/components/ImageGen/TextToImageForm.tsx src/components/ImageGen/Img2ImgPanel.tsx src/components/ImageGen/ReversePromptPanel.tsx src/components/ImageGen/ImageGenView.tsx src/hooks/useImageActions.ts src/types/index.ts
git commit -m "feat: rebuild image creation controls"
```

### Task 4: Add Explicit Image Task State and the Result Canvas

**Files:**
- Create: `src/lib/image-task.ts`
- Create: `src/lib/image-task.test.ts`
- Modify: `src/lib/store.ts`
- Modify: `src/hooks/useImageActions.ts`
- Create: `src/components/ImageGen/ResultCanvas.tsx`
- Modify: `src/components/ImageGen/ImageGenView.tsx`
- Delete: `src/components/ImageGen/ImageResultPanel.tsx`

**Interfaces:**
- Produces: `ImageTaskState`, `ImageTaskError`, `ImageTaskRequest`, `classifyImageTaskError`.
- Produces store setters `startImageTask`, `finishImageTask`, `failImageTask`, `clearImageTask`.
- Produces `ResultCanvas` with idle, generating, success, and error states.

- [ ] **Step 1: Write failing task-error tests**

Create `src/lib/image-task.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/lib/client-api";
import { classifyImageTaskError } from "./image-task";

describe("image task errors", () => {
  it("classifies insufficient credits", () => {
    assert.deepEqual(classifyImageTaskError(new ApiError("积分不足", 402, "INSUFFICIENT_CREDITS")), {
      kind: "credits",
      message: "积分不足",
    });
  });

  it("classifies API and network failures", () => {
    assert.equal(classifyImageTaskError(new ApiError("服务失败", 502)).kind, "service");
    assert.equal(classifyImageTaskError(new Error("offline")).kind, "network");
  });
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
node --import tsx --test src/lib/image-task.test.ts
```

Expected: FAIL because `image-task.ts` does not exist.

- [ ] **Step 3: Implement task types and classification**

Create `src/lib/image-task.ts`:

```ts
import { ApiError } from "@/lib/client-api";

export type ImageTaskErrorKind = "credits" | "network" | "service";
export interface ImageTaskError { kind: ImageTaskErrorKind; message: string; }
export interface ImageTaskRequest { mode: "text" | "edit"; prompt: string; size: string; count: number; images?: string[]; }
export interface ImageTaskState {
  status: "idle" | "generating" | "success" | "error";
  startedAt: number | null;
  request: ImageTaskRequest | null;
  resultIds: string[];
  error: ImageTaskError | null;
}

export function classifyImageTaskError(error: unknown): ImageTaskError {
  if (error instanceof ApiError && error.code === "INSUFFICIENT_CREDITS") return { kind: "credits", message: error.message };
  if (error instanceof ApiError) return { kind: "service", message: error.message || "图片生成失败" };
  return { kind: "network", message: "网络错误，请检查连接后重试" };
}
```

- [ ] **Step 4: Store and update task state in one place**

Add `imageTask` and the four task setters to the Zustand store. Refactor `handleGenerateImageBatch` and both edit paths so each user action owns one task. Batch text generation reuses one abort signal, appends all successful records together, and finishes with all result IDs; it must not start and finish a separate task per image. Change each path to this lifecycle:

```ts
startImageTask(request);
try {
  const results = await requestImages();
  setImageHistory((prev) => [...results, ...prev]);
  finishImageTask(results.map((item) => item.id));
} catch (error) {
  if (!(error instanceof Error && error.name === "AbortError")) {
    failImageTask(classifyImageTaskError(error));
  }
}
```

Retain wallet opening for insufficient credits. Keep the last request in state so the UI can call a new `handleRetryImageTask()` action without reconstructing parameters.

- [ ] **Step 5: Create the result canvas**

Create `ResultCanvas.tsx` with this contract:

```ts
interface ResultCanvasProps {
  task: ImageTaskState;
  activeImage: ImageRecord | null;
  batchImages: ImageRecord[];
  onPreview: (image: ImageRecord) => void;
  onDownload: (image: ImageRecord) => void;
  onCopyPrompt: (image: ImageRecord) => void;
  onEdit: (image: ImageRecord) => void;
  onRetry: () => void;
  onStop: () => void;
}
```

Render:

- idle: quiet brand mark and one instruction;
- generating: aspect-ratio skeleton, `ThinkingOrb`, elapsed time, stop button;
- success: one centered image or a two-column grid from `resultIds`;
- error: classified message and retry button while preserving the request.

- [ ] **Step 6: Replace the old result component and verify**

Update `ImageGenView` imports and delete `ImageResultPanel.tsx` only after no references remain.

Run:

```powershell
node --import tsx --test src/lib/image-task.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; stopping does not show an error, retry uses the stored request, and batch results render from current-session result IDs.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/image-task.ts src/lib/image-task.test.ts src/lib/store.ts src/hooks/useImageActions.ts src/components/ImageGen/ResultCanvas.tsx src/components/ImageGen/ImageGenView.tsx src/components/ImageGen/ImageResultPanel.tsx
git commit -m "feat: add focused image result canvas"
```

### Task 5: Replace the History Column with an Asset Inspector

**Files:**
- Create: `src/lib/image-library.ts`
- Create: `src/lib/image-library.test.ts`
- Create: `src/components/ImageGen/AssetInspector.tsx`
- Create: `src/components/ImageGen/ImageActionMenu.tsx`
- Modify: `src/components/ImageGen/ImageGenView.tsx`
- Modify: `src/hooks/useImageActions.ts`
- Modify: `src/types/index.ts`
- Delete: `src/components/ImageGen/ImageHistoryPanel.tsx`

**Interfaces:**
- Produces: `ImageSourceMode`, `ImageHistoryGroup`, `groupImagesByDate`, `filterImages`, `mergeImageSourceModes`, `reuseParametersFromImage`.
- Produces: `AssetInspector({ history, activeImage, tab, collapsed, ... })`.
- Uses localStorage key `deep-roast-image-source-map` only for `{ [imageId]: "text" | "edit" }`; old or cross-device records remain `"unknown"` and continue to appear under “全部”.

- [ ] **Step 1: Write failing grouping and filtering tests**

Create `src/lib/image-library.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ImageRecord } from "@/types";
import { filterImages, groupImagesByDate, mergeImageSourceModes, reuseParametersFromImage } from "./image-library";

const image = (id: string, createdAt: string, prompt = "coffee"): ImageRecord => ({
  id, prompt, createdAt, model: "gpt-image-2", imageUrl: `/images/${id}.png`, size: "1024x1024",
});

describe("image library", () => {
  it("groups today, yesterday, and older records", () => {
    const now = new Date("2026-08-20T12:00:00+08:00");
    const groups = groupImagesByDate([
      image("a", "2026-08-20T03:00:00.000Z"),
      image("b", "2026-08-19T03:00:00.000Z"),
      image("c", "2026-08-10T03:00:00.000Z"),
    ], now);
    assert.deepEqual(groups.map((group) => group.label), ["今天", "昨天", "更早"]);
  });

  it("filters by prompt and known source mode", () => {
    const rows = mergeImageSourceModes([image("a", "2026-08-20", "cat"), image("b", "2026-08-20", "dog")], { a: "text", b: "edit" });
    assert.deepEqual(filterImages(rows, "cat", "all").map((row) => row.id), ["a"]);
    assert.deepEqual(filterImages(rows, "", "edit").map((row) => row.id), ["b"]);
  });

  it("extracts prompt, ratio, and model for parameter reuse", () => {
    assert.deepEqual(reuseParametersFromImage(image("a", "2026-08-20", "cat")), {
      prompt: "cat",
      size: "1024x1024",
      model: "gpt-image-2",
    });
  });
});
```

- [ ] **Step 2: Verify failure**

Run:

```powershell
node --import tsx --test src/lib/image-library.test.ts
```

Expected: FAIL because `image-library.ts` does not exist.

- [ ] **Step 3: Implement pure library helpers**

Create `src/lib/image-library.ts` with these exported types and functions:

```ts
import type { ImageRecord } from "@/types";

export type ImageSourceMode = "text" | "edit" | "unknown";
export type ImageFilterMode = "all" | "text" | "edit";
export type LibraryImage = ImageRecord & { sourceMode: ImageSourceMode };
export interface ImageHistoryGroup { label: "今天" | "昨天" | "更早"; images: LibraryImage[]; }

export function mergeImageSourceModes(images: ImageRecord[], sourceMap: Record<string, ImageSourceMode>): LibraryImage[] {
  return images.map((image) => ({ ...image, sourceMode: sourceMap[image.id] || "unknown" }));
}

export function filterImages(images: LibraryImage[], query: string, mode: ImageFilterMode): LibraryImage[] {
  const needle = query.trim().toLowerCase();
  return images.filter((image) => (!needle || image.prompt.toLowerCase().includes(needle)) && (mode === "all" || image.sourceMode === mode));
}

export function reuseParametersFromImage(image: ImageRecord) {
  return { prompt: image.prompt, size: image.size, model: image.model };
}

export function groupImagesByDate(images: LibraryImage[], now = new Date()): ImageHistoryGroup[] {
  const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const buckets: Record<ImageHistoryGroup["label"], LibraryImage[]> = { 今天: [], 昨天: [], 更早: [] };
  for (const image of images) {
    const created = new Date(image.createdAt);
    const label = dayKey(created) === dayKey(now) ? "今天" : dayKey(created) === dayKey(yesterday) ? "昨天" : "更早";
    buckets[label].push(image);
  }
  return (["今天", "昨天", "更早"] as const).filter((label) => buckets[label].length > 0).map((label) => ({ label, images: buckets[label] }));
}
```

- [ ] **Step 4: Record source mode for new images**

Add optional `sourceMode?: ImageSourceMode` to `ImageRecord`. In `useImageActions`, mark text results as `"text"` and edit/batch results as `"edit"`; update the local source map after a successful result. Loading old history merges the map and leaves missing IDs as `"unknown"`.

- [ ] **Step 5: Create the inspector and action menu**

`AssetInspector` must render:

- a collapse button;
- `history` and `details` tabs;
- two-column grouped thumbnails, search, and all/text/edit filters;
- complete prompt, model, size, time, copy, reuse, edit, download, and delete actions in details;
- a 44px collapsed rail and a 300px expanded panel.

Use `ImageActionMenu` for delete and other secondary actions; do not render always-visible red × buttons. “复用参数” uses the tested helper to update the text draft plus selected image model, then switches to text mode. “进入图生图” sets the image URL as the first edit reference and switches to edit mode.

- [ ] **Step 6: Replace the old history panel and verify**

Update `ImageGenView`, remove `ImageHistoryPanel.tsx`, and preserve the existing confirmation dialog before deletion.

Run:

```powershell
node --import tsx --test src/lib/image-library.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; unknown legacy images appear in “全部”, current-browser text/edit records filter correctly, and collapse state survives a reload.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/image-library.ts src/lib/image-library.test.ts src/components/ImageGen/AssetInspector.tsx src/components/ImageGen/ImageActionMenu.tsx src/components/ImageGen/ImageGenView.tsx src/hooks/useImageActions.ts src/types/index.ts src/components/ImageGen/ImageHistoryPanel.tsx
git commit -m "feat: add image asset inspector"
```

### Task 6: Rebuild the Conversation Workspace

**Files:**
- Create: `src/lib/conversation-library.ts`
- Create: `src/lib/conversation-library.test.ts`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Chat/TextModePanel.tsx`
- Modify: `src/components/Chat/ChatView.tsx`
- Modify: `src/components/Chat/ChatInput.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `ConversationGroup`, `filterConversations`, `groupConversations`.
- Preserves the existing `TextModePanelProps` business callbacks.

- [ ] **Step 1: Write failing conversation grouping tests**

Create `src/lib/conversation-library.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Conversation } from "@/types";
import { filterConversations, groupConversations } from "./conversation-library";

const conversation = (id: string, title: string, updatedAt: string): Conversation => ({
  id, title, updatedAt, createdAt: updatedAt, model: "doubao", messageCount: 1,
});

describe("conversation library", () => {
  it("filters titles case-insensitively", () => {
    const rows = [conversation("1", "Design Notes", "2026-08-20"), conversation("2", "旅行", "2026-08-20")];
    assert.deepEqual(filterConversations(rows, "design").map((row) => row.id), ["1"]);
  });

  it("groups today, seven days, and older", () => {
    const now = new Date("2026-08-20T12:00:00+08:00");
    const groups = groupConversations([
      conversation("1", "a", "2026-08-20T02:00:00.000Z"),
      conversation("2", "b", "2026-08-17T02:00:00.000Z"),
      conversation("3", "c", "2026-07-01T02:00:00.000Z"),
    ], now);
    assert.deepEqual(groups.map((group) => group.label), ["今天", "最近 7 天", "更早"]);
  });
});
```

- [ ] **Step 2: Verify failure and implement helpers**

Run:

```powershell
node --import tsx --test src/lib/conversation-library.test.ts
```

Expected: FAIL because the module is missing.

Create `conversation-library.ts` with `ConversationGroup`, a lower-case title filter, and elapsed-day grouping into `今天`, `最近 7 天`, and `更早`.

- [ ] **Step 3: Rebuild the conversation sidebar**

Keep the sidebar at 260px. Add a search field below the fixed new-conversation button, render grouped conversations, and replace inline delete with a focusable more menu containing rename and delete. Use the existing `ConfirmDialog` for deletion.

- [ ] **Step 4: Change AI messages to document-style output**

In `ChatView`, keep user messages as compact accent bubbles. Render assistant content without the rounded bubble container:

```tsx
<article className="chat-assistant-message">
  <div className="whitespace-pre-wrap break-words leading-7">{message.content}</div>
  <MessageActions />
</article>
```

Keep reasoning collapsed, preserve streaming behavior, and keep copy/regenerate keyboard reachable.

- [ ] **Step 5: Refine the composer and empty state**

Keep the input centered at max width 800px, show the current per-response credit cost, retain Enter/Shift+Enter behavior, and provide three low-emphasis starter prompts in the empty state.

- [ ] **Step 6: Verify**

Run:

```powershell
node --import tsx --test src/lib/conversation-library.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; search and grouping work, message streaming still finishes correctly, and switching image/chat preserves the current conversation.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/conversation-library.ts src/lib/conversation-library.test.ts src/components/Sidebar.tsx src/components/Chat/TextModePanel.tsx src/components/Chat/ChatView.tsx src/components/Chat/ChatInput.tsx src/app/globals.css
git commit -m "feat: rebuild conversation workspace"
```

### Task 7: Establish the Admin Shell, Navigation, and Overview

**Files:**
- Create: `src/lib/admin-navigation.ts`
- Create: `src/lib/admin-navigation.test.ts`
- Create: `src/components/Admin/AdminShell.tsx`
- Create: `src/components/Admin/AdminNavigation.tsx`
- Modify: `src/components/Admin/AdminDashboard.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `AdminSection = "overview" | "users" | "site" | "ai"`, `parseAdminSection`.
- Produces: `AdminShell({ section, onSectionChange, onBack, children })`.
- `AdminDashboard` becomes read-only overview content and no longer renders settings cards.

- [ ] **Step 1: Write failing navigation tests**

Create `src/lib/admin-navigation.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAdminSection } from "./admin-navigation";

describe("admin navigation", () => {
  it("accepts known sections and falls back to overview", () => {
    assert.equal(parseAdminSection("users"), "users");
    assert.equal(parseAdminSection("site"), "site");
    assert.equal(parseAdminSection("ai"), "ai");
    assert.equal(parseAdminSection("unknown"), "overview");
    assert.equal(parseAdminSection(null), "overview");
  });
});
```

- [ ] **Step 2: Verify failure and implement parsing**

Create `admin-navigation.ts`:

```ts
export type AdminSection = "overview" | "users" | "site" | "ai";

export function parseAdminSection(value: string | null): AdminSection {
  return value === "users" || value === "site" || value === "ai" ? value : "overview";
}
```

Run the focused test and expect PASS.

- [ ] **Step 3: Create the admin shell and true navigation**

Build `AdminShell` with a 220px `AdminNavigation`, main content area, mobile menu button, and return-to-workspace action. `AdminNavigation` renders only the four first-level sections; it must not render users.

Use a `section` search parameter via `window.history.replaceState` or client router navigation so browser Back restores the prior admin section without introducing new server pages. Parse it with `parseAdminSection`.

- [ ] **Step 4: Reduce the overview to read-only status**

Remove `AdminSiteSettingsCard`, `AdminAnnouncementsCard`, `AdminDonationCard`, `AdminStylesCard`, and `AdminStyleTestCard` from `AdminDashboard`. Keep the four statistic cards and add compact read-only status rows for registration, donation, and banned users, using already loaded responses. Each status row changes `AdminSection` to its owning module.

- [ ] **Step 5: Wire the admin page**

`src/app/admin/page.tsx` remains the data orchestration client component. Replace `mainView` with `section` plus `selectedUser`. Render overview, users, site, or AI content inside `AdminShell`.

- [ ] **Step 6: Verify**

Run:

```powershell
node --import tsx --test src/lib/admin-navigation.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; the admin sidebar contains four modules only, overview has no edit forms, and browser Back preserves section navigation.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/admin-navigation.ts src/lib/admin-navigation.test.ts src/components/Admin/AdminShell.tsx src/components/Admin/AdminNavigation.tsx src/components/Admin/AdminDashboard.tsx src/app/admin/page.tsx src/app/globals.css
git commit -m "feat: establish admin information architecture"
```

### Task 8: Build User Search, Filtering, and a Dedicated User Detail

**Files:**
- Create: `src/lib/admin-users.ts`
- Create: `src/lib/admin-users.test.ts`
- Create: `src/components/Admin/AdminUsersPage.tsx`
- Create: `src/components/Admin/AdminUserDetail.tsx`
- Modify: `src/components/Admin/AdminUserList.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/components/ConfirmDialog.tsx`

**Interfaces:**
- Produces: `AdminUserFilter`, `AdminUserSort`, `filterAndSortAdminUsers`.
- Produces `AdminUsersPage` table and `AdminUserDetail` tabs for overview, images, conversations, and credits.
- Task 8 renders those four detail tabs only. Task 11 adds the API-key tab after its service and UI are available; do not render a fake or inactive API control.

- [ ] **Step 1: Write failing user-filter tests**

Create `src/lib/admin-users.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AdminUser } from "@/types";
import { filterAndSortAdminUsers } from "./admin-users";

const user = (id: string, username: string, role: string, status: string, lastActive: string | null): AdminUser => ({
  id, username, role, status, lastActive, credits: 50, conversationCount: 0, imageCount: 0, createdAt: "2026-01-01",
});

describe("admin users", () => {
  const rows = [user("1", "Alice", "user", "active", "2026-08-20"), user("2", "Bob", "admin", "active", "2026-08-19"), user("3", "Carol", "user", "banned", null)];

  it("filters query, role, and status", () => {
    assert.deepEqual(filterAndSortAdminUsers(rows, { query: "car", role: "user", status: "banned", sort: "recent" }).map((row) => row.id), ["3"]);
  });

  it("sorts most recent users first and null last", () => {
    assert.deepEqual(filterAndSortAdminUsers(rows, { query: "", role: "all", status: "all", sort: "recent" }).map((row) => row.id), ["1", "2", "3"]);
  });
});
```

- [ ] **Step 2: Verify failure and implement filters**

Create `admin-users.ts` with exact filter values `role: "all" | "user" | "admin"`, `status: "all" | "active" | "banned"`, and `sort: "recent" | "created" | "credits"`. Return a copied, filtered, sorted array.

- [ ] **Step 3: Convert the user list into a table**

Refactor `AdminUserList` into a presentational table used by `AdminUsersPage`. Render username, status, credits, conversations, images, recent activity, and a row action. Add a toolbar with the tested query/filter/sort values. On narrow screens, the table becomes stacked rows without horizontal page overflow.

- [ ] **Step 4: Extract the user detail**

Move dossier header, tabs, images, conversations, credits, refresh, reset password, ban, and delete UI from `admin/page.tsx` into `AdminUserDetail`. Use breadcrumb text `用户管理 / {username}`.

Replace native `confirm()` calls with controlled `ConfirmDialog` state. Keep ban/delete inside a visibly separated danger section or more menu; never place delete next to refresh as an equal visual action.

- [ ] **Step 5: Verify**

Run:

```powershell
node --import tsx --test src/lib/admin-users.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; search/filter/sort use loaded data only, and selecting a user opens a full-width detail instead of retaining a permanent user rail.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/admin-users.ts src/lib/admin-users.test.ts src/components/Admin/AdminUsersPage.tsx src/components/Admin/AdminUserDetail.tsx src/components/Admin/AdminUserList.tsx src/app/admin/page.tsx src/components/ConfirmDialog.tsx
git commit -m "feat: rebuild admin user management"
```

### Task 9: Separate Site Content and AI Capability Management

**Files:**
- Create: `src/lib/admin-tabs.ts`
- Create: `src/lib/admin-tabs.test.ts`
- Create: `src/components/Admin/AdminSiteContentPage.tsx`
- Create: `src/components/Admin/AdminAiCapabilitiesPage.tsx`
- Create: `src/components/Settings/AdminModelSettingsPanel.tsx`
- Modify: `src/components/Settings/SettingsModal.tsx`
- Modify: `src/components/Admin/AdminSiteSettingsCard.tsx`
- Modify: `src/components/Admin/AdminAnnouncementsCard.tsx`
- Modify: `src/components/Admin/AdminDonationCard.tsx`
- Modify: `src/components/Admin/AdminStylesCard.tsx`
- Modify: `src/components/Admin/AdminStyleTestCard.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `SiteTab = "settings" | "announcements" | "donation"` and `AiTab = "models" | "styles" | "test"`.
- Produces: `parseSiteTab`, `parseAiTab`, `hasUnsavedChanges`, `AdminSiteContentPage`, and `AdminAiCapabilitiesPage`.
- `AdminModelSettingsPanel` owns the reusable model-provider form body; `SettingsModal` owns only modal framing and user/admin visibility rules.

- [ ] **Step 1: Write failing tab-parser tests**

Create `src/lib/admin-tabs.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasUnsavedChanges, parseAiTab, parseSiteTab } from "./admin-tabs";

describe("admin module tabs", () => {
  it("parses site tabs", () => {
    assert.equal(parseSiteTab("announcements"), "announcements");
    assert.equal(parseSiteTab("donation"), "donation");
    assert.equal(parseSiteTab("unknown"), "settings");
  });

  it("parses AI tabs", () => {
    assert.equal(parseAiTab("styles"), "styles");
    assert.equal(parseAiTab("test"), "test");
    assert.equal(parseAiTab(null), "models");
  });

  it("detects unsaved form snapshots", () => {
    assert.equal(hasUnsavedChanges("saved", "saved"), false);
    assert.equal(hasUnsavedChanges("saved", "edited"), true);
  });
});
```

- [ ] **Step 2: Verify failure and implement the parsers**

Create `src/lib/admin-tabs.ts`:

```ts
export type SiteTab = "settings" | "announcements" | "donation";
export type AiTab = "models" | "styles" | "test";

export function parseSiteTab(value: string | null): SiteTab {
  return value === "announcements" || value === "donation" ? value : "settings";
}

export function parseAiTab(value: string | null): AiTab {
  return value === "styles" || value === "test" ? value : "models";
}

export function hasUnsavedChanges(initialSnapshot: string, currentSnapshot: string): boolean {
  return initialSnapshot !== currentSnapshot;
}
```

Run:

```powershell
node --import tsx --test src/lib/admin-tabs.test.ts
```

Expected: PASS.

- [ ] **Step 3: Build the two management pages**

`AdminSiteContentPage` renders a compact tab strip and exactly one of `AdminSiteSettingsCard`, `AdminAnnouncementsCard`, or `AdminDonationCard`. `AdminAiCapabilitiesPage` does the same for model configuration, style management, and style testing. Persist the tab in `siteTab` or `aiTab` search parameters so browser navigation is deterministic.

Use this component contract:

```ts
type AdminSiteContentPageProps = {
  tab: SiteTab;
  onTabChange: (tab: SiteTab) => void;
};

type AdminAiCapabilitiesPageProps = {
  tab: AiTab;
  onTabChange: (tab: AiTab) => void;
};
```

- [ ] **Step 4: Extract the reusable model settings body**

Move the provider/model fields and save behavior from `SettingsModal` into `AdminModelSettingsPanel`. Keep all existing request URLs and payload shapes unchanged. Render the panel in the AI module; keep `SettingsModal` functional for any remaining entry point, but remove duplicate form state.

- [ ] **Step 5: Normalize editing cards**

Give each card one page heading, one short description, a restrained form surface, an inline save status, and a single primary save action. Replace any native `alert()` or `confirm()` with inline feedback or the controlled `ConfirmDialog`. Track each form's initial serialized value and dirty state; changing the module or tab while dirty must open a discard-confirmation dialog. Keep announcements, donation settings, styles, and style tests behavior-compatible with their current endpoints.

- [ ] **Step 6: Wire module tabs in the admin page**

When `section === "site"`, render `AdminSiteContentPage`; when `section === "ai"`, render `AdminAiCapabilitiesPage`. Update only the relevant search parameter and preserve the current first-level section.

- [ ] **Step 7: Verify**

Run:

```powershell
node --import tsx --test src/lib/admin-tabs.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; each admin module displays one focused editor at a time, and settings behavior still uses the existing APIs.

- [ ] **Step 8: Commit**

```powershell
git add src/lib/admin-tabs.ts src/lib/admin-tabs.test.ts src/components/Admin/AdminSiteContentPage.tsx src/components/Admin/AdminAiCapabilitiesPage.tsx src/components/Settings/AdminModelSettingsPanel.tsx src/components/Settings/SettingsModal.tsx src/components/Admin/AdminSiteSettingsCard.tsx src/components/Admin/AdminAnnouncementsCard.tsx src/components/Admin/AdminDonationCard.tsx src/components/Admin/AdminStylesCard.tsx src/components/Admin/AdminStyleTestCard.tsx src/app/admin/page.tsx src/app/globals.css
git commit -m "feat: separate admin configuration modules"
```

### Task 10: Add Admin API-Key Services and Usage Accounting

**Files:**
- Modify: `src/db/schema.ts`
- Generate: the next SQL migration and Drizzle metadata under `drizzle/`
- Modify: `src/types/index.ts`
- Modify: `src/server/auth.ts`
- Create: `src/server/auth.test.ts`
- Modify: `src/server/services/api-keys.ts`
- Modify: `src/server/services/api-keys.test.ts`
- Create: `src/app/api/admin/users/[id]/api-keys/route.ts`
- Create: `src/app/api/admin/users/[id]/api-keys/[keyId]/route.ts`
- Modify: `src/app/api/v1/images/generations/route.ts`

**Interfaces:**
- Extends each API-key record with `usageCount: number` and `creditsConsumed: number`.
- `resolveApiKeyUser` returns the authenticated user plus `apiKeyId` for API-key requests.
- Produces admin-only list/create/update/delete operations scoped by both `userId` and `keyId`.
- Plaintext keys are returned only from create operations; list and mutation responses return prefix and metadata only.

- [ ] **Step 1: Extend authorization and service tests first**

Create `src/server/auth.test.ts` and extend `src/server/services/api-keys.test.ts` for these pure exports before implementing them:

```ts
// src/server/auth.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "@/server/http";
import { assertAdminRole } from "./auth";

describe("admin authorization", () => {
  it("rejects ordinary users", () => {
    assert.throws(
      () => assertAdminRole("user"),
      (error: unknown) => error instanceof ApiError && error.status === 403,
    );
  });

  it("accepts admins", () => assert.doesNotThrow(() => assertAdminRole("admin")));
});

// additions to src/server/services/api-keys.test.ts
import { apiKeyUsageDelta, assertApiKeyOwnership, normalizeApiKeyStatus } from "./api-keys";

it("accepts only mutable API-key statuses", () => {
  assert.equal(normalizeApiKeyStatus("active"), "active");
  assert.equal(normalizeApiKeyStatus("disabled"), "disabled");
  assert.throws(() => normalizeApiKeyStatus("revoked"));
});

it("records one successful request and non-negative credit usage", () => {
  assert.deepEqual(apiKeyUsageDelta(12), { usageCount: 1, creditsConsumed: 12 });
  assert.deepEqual(apiKeyUsageDelta(-1), { usageCount: 1, creditsConsumed: 0 });
});

it("rejects a key owned by another target user", () => {
  assert.doesNotThrow(() => assertApiKeyOwnership("user-a", "user-a"));
  assert.throws(
    () => assertApiKeyOwnership("user-a", "user-b"),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  );
});
```

Run:

```powershell
node --import tsx --test src/server/auth.test.ts
node --import tsx --test src/server/services/api-keys.test.ts
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 2: Extend the schema and generate the migration**

Add non-null integer columns with zero defaults:

```ts
usageCount: integer("usage_count").notNull().default(0),
creditsConsumed: integer("credits_consumed").notNull().default(0),
```

Run:

```powershell
npm.cmd run db:generate
git diff --name-only -- drizzle
```

Expected: one new numbered SQL migration plus its Drizzle journal/snapshot metadata. Record the exact generated paths in the task log and stage those generated files in Step 9; do not rename or hand-edit generated metadata.

- [ ] **Step 3: Implement validated status and usage helpers**

Add:

```ts
export type MutableApiKeyStatus = "active" | "disabled";

export function normalizeApiKeyStatus(value: unknown): MutableApiKeyStatus {
  if (value === "active" || value === "disabled") return value;
  throw new Error("INVALID_API_KEY_STATUS");
}

export function apiKeyUsageDelta(credits: number) {
  return { usageCount: 1, creditsConsumed: Math.max(0, Math.floor(credits)) };
}

export function assertApiKeyOwnership(targetUserId: string, ownerUserId: string): void {
  if (targetUserId !== ownerUserId) throw new ApiError("Key 不存在", 404);
}
```

Run the focused service test and expect PASS.

Add `assertAdminRole(role)` to `src/server/auth.ts`, use it from both `requireAdmin` and `requireActiveAdmin`, and run `src/server/auth.test.ts` until it passes. This makes the route authorization decision directly testable while retaining the existing request/session lookup.

- [ ] **Step 4: Add scoped service operations**

Implement these service contracts without changing the existing self-service functions:

```ts
export function listUserApiKeysForAdmin(userId: string): Promise<ApiKeyRecord[]>;
export function createUserApiKeyForAdmin(userId: string, name: string): Promise<CreatedApiKey>;
export function updateUserApiKeyStatusForAdmin(userId: string, keyId: string, status: MutableApiKeyStatus): Promise<ApiKeyRecord>;
export function deleteUserApiKeyForAdmin(userId: string, keyId: string): Promise<void>;
export function recordApiKeyUsage(keyId: string, credits: number): Promise<void>;
```

Every lookup, update, and delete must match both `apiKeys.id` and `apiKeys.userId`; mutation paths also call the tested ownership assertion before returning a record. The create function must verify that the target user exists and must continue enforcing the existing quota of ten keys per user. `recordApiKeyUsage` atomically increments both counters and updates `lastUsedAt`.

- [ ] **Step 5: Carry the API-key identity through authentication**

Extend the authenticated request-user type with optional `apiKeyId?: string`. Password/session requests leave it undefined; `resolveApiKeyUser` sets it from the matched key row. Preserve all current authorization checks and reject disabled keys. Remove the current fire-and-forget `lastUsedAt` update from authentication; successful usage accounting in Step 7 becomes the only place that advances usage timestamps.

- [ ] **Step 6: Add admin route handlers**

Implement route handlers with Next.js 16 async params:

```ts
type UserParams = { params: Promise<{ id: string }> };
type KeyParams = { params: Promise<{ id: string; keyId: string }> };
```

`/api/admin/users/[id]/api-keys` supports `GET` and `POST`; `/api/admin/users/[id]/api-keys/[keyId]` supports `PATCH` and `DELETE`. Every method calls `requireActiveAdmin`, validates IDs/name/status, uses the scoped service function, and maps not-found/invalid input to the project’s existing JSON error shape. `POST` returns the plaintext key exactly once.

- [ ] **Step 7: Record successful gateway usage**

After `/api/v1/images/generations` has successfully produced image results and consumed credits, call:

```ts
if (requestUser.apiKeyId) {
  await recordApiKeyUsage(requestUser.apiKeyId, consumedCredits).catch((error) => {
    console.error("Failed to record API key usage", error);
  });
}
```

Import `CREDIT_PER_IMAGE` and set `consumedCredits` to `0` for admins or `results.length * CREDIT_PER_IMAGE` for charged users. Count one successful gateway request and the actual total credits consumed by all images in that response. Telemetry failure must be logged but must not discard an already generated image response.

- [ ] **Step 8: Verify migration and service behavior**

Run:

```powershell
node --import tsx --test src/server/auth.test.ts
node --import tsx --test src/server/services/api-keys.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; route handlers compile under the local Next.js 16 conventions; existing self-service API-key behavior remains intact.

- [ ] **Step 9: Commit**

Stage the exact migration files reported in Step 2 together with:

```powershell
git add src/db/schema.ts src/types/index.ts src/server/auth.ts src/server/auth.test.ts src/server/services/api-keys.ts src/server/services/api-keys.test.ts 'src/app/api/admin/users/[id]/api-keys/route.ts' 'src/app/api/admin/users/[id]/api-keys/[keyId]/route.ts' src/app/api/v1/images/generations/route.ts drizzle
git commit -m "feat: add admin API key management services"
```

### Task 11: Build the Admin API-Key Management Interface

**Files:**
- Create: `src/lib/api-key-ui.ts`
- Create: `src/lib/api-key-ui.test.ts`
- Create: `src/components/Admin/AdminApiKeysTab.tsx`
- Modify: `src/components/Admin/AdminUserDetail.tsx`
- Modify: `src/components/ApiKeysModal.tsx`
- Modify: `src/types/index.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `canDismissCreatedKey`, `apiKeyStatusLabel`, and `AdminApiKeysTab`.
- Admins can list, create, enable/disable, and delete keys for the selected user.
- Existing plaintext can never be revealed; a newly created plaintext key remains visible only in the one-time creation dialog.

- [ ] **Step 1: Write failing one-time-key tests**

Create `src/lib/api-key-ui.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apiKeyStatusLabel, canDismissCreatedKey } from "./api-key-ui";

describe("API-key UI", () => {
  it("requires an explicit saved acknowledgement before dismissal", () => {
    assert.equal(canDismissCreatedKey(false), false);
    assert.equal(canDismissCreatedKey(true), true);
  });

  it("uses stable Chinese status labels", () => {
    assert.equal(apiKeyStatusLabel("active"), "已启用");
    assert.equal(apiKeyStatusLabel("disabled"), "已停用");
  });
});
```

- [ ] **Step 2: Verify failure and implement helpers**

Create `src/lib/api-key-ui.ts`:

```ts
export function canDismissCreatedKey(acknowledged: boolean): boolean {
  return acknowledged;
}

export function apiKeyStatusLabel(status: "active" | "disabled"): string {
  return status === "active" ? "已启用" : "已停用";
}
```

Run the focused test and expect PASS.

- [ ] **Step 3: Build the API-key tab**

`AdminApiKeysTab` accepts `userId` and fetches `/api/admin/users/${userId}/api-keys` when mounted. Render a table/list with name, prefix, status, last use, request count, consumed credits, and creation date. Provide create, enable/disable, and delete actions; use `ConfirmDialog` before disabling or deleting, and inline error/loading states for every mutation. Enabling a disabled key can proceed directly.

Use this contract:

```ts
type AdminApiKeysTabProps = {
  userId: string;
};
```

After each successful mutation, replace the local row from the response or refetch the list. Disable row actions while that row is mutating.

- [ ] **Step 4: Implement the one-time plaintext dialog**

After create succeeds, show the returned key in a non-dismissible dialog with a copy button and warning text. The close button remains disabled until the admin checks “我已安全保存此密钥”. Closing clears the plaintext from component state. Never append the plaintext to logs, URLs, toasts, or list rows.

- [ ] **Step 5: Connect the user detail tab**

Add the fifth detail tab and render `AdminApiKeysTab`. The tab badge may show the loaded key count, but the parent must not duplicate API-key state. Keep the selected user context when switching tabs.

- [ ] **Step 6: Polish the existing self-service modal**

Keep its current user-only endpoints and permissions. Replace emoji icons with the shared SVG icon set, apply the same one-time acknowledgement rule to newly created plaintext keys, and align table/status styling with the admin tab. Do not add admin capabilities to this modal.

- [ ] **Step 7: Verify**

Run:

```powershell
node --import tsx --test src/lib/api-key-ui.test.ts
npm.cmd run lint
npm.cmd run build
```

Expected: all commands exit 0; plaintext is shown only after creation, existing keys show only prefixes, and every admin action remains scoped to the selected user.

- [ ] **Step 8: Commit**

```powershell
git add src/lib/api-key-ui.ts src/lib/api-key-ui.test.ts src/components/Admin/AdminApiKeysTab.tsx src/components/Admin/AdminUserDetail.tsx src/components/ApiKeysModal.tsx src/types/index.ts src/app/globals.css
git commit -m "feat: add admin API key management UI"
```

### Task 12: Complete Responsive, Accessibility, and Regression Verification

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/Workspace/AppShell.tsx`
- Modify: `src/components/ImageGen/ImageGenView.tsx`
- Modify: `src/components/ImageGen/ImageMobileBar.tsx`
- Modify: `src/components/ImageGen/MobileDrawer.tsx`
- Modify: `src/components/ImageGen/AssetInspector.tsx`
- Modify: `src/components/Admin/AdminShell.tsx`
- Modify: `src/components/ConfirmDialog.tsx`
- Modify: `src/components/ApiKeysModal.tsx`
- Modify: `src/components/Header.tsx`

**Constraints:**
- Desktop is the primary target; tablet and phone remain fully operable.
- No horizontal page overflow at 375px, 768px, 1280px, or 1440px.
- All icon-only controls have accessible names, all dialogs trap focus and restore it on close, and all menus/drawers close on Escape.
- Fixed mobile controls account for `env(safe-area-inset-bottom)` and the existing keyboard inset.
- Body text remains at least 13px, focus indicators are visible, contrast is checked against WCAG AA, and motion respects `prefers-reduced-motion`.

- [ ] **Step 1: Normalize layout breakpoints**

Use the final behavior matrix:

| Width | Image workspace | Chat workspace | Admin |
|---|---|---|---|
| `>= 1280px` | 320px creation / fluid canvas / 300px history | 280px conversations / fluid document | 220px nav / fluid content |
| `768–1279px` | creation panel narrows; history becomes drawer | conversation rail collapsible | nav collapsible |
| `< 768px` | canvas first; creation and history use bottom sheets/drawers | document first; conversations use drawer | content first; nav uses drawer |

Keep the canvas and document areas mounted when side panels open so drafts/results do not reset.

- [ ] **Step 2: Add safe-area and keyboard handling**

Implement a shared mobile fixed-control rule:

```css
.mobile-fixed-control {
  bottom: var(--keyboard-inset, 0px);
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
```

Apply it to `ImageMobileBar`, chat input framing, and bottom sheets. Verify that opening the on-screen keyboard does not cover the primary action.

- [ ] **Step 3: Finish keyboard and screen-reader behavior**

Add `aria-label` to icon-only buttons, `aria-current="page"` to active navigation, and `aria-selected`/tab semantics to tab strips. Drawers and menus close on Escape. Dialogs use `role="dialog"`, `aria-modal="true"`, focus the first meaningful control, trap Tab navigation, and restore focus to the trigger when closed.

- [ ] **Step 4: Check rendering cost and reduced motion**

Use `useMemo` for filtered/grouped image, conversation, and user collections; use `thumbUrl` in all list grids and the full image only in the canvas/preview; avoid mounting duplicate modal bodies. Add a `prefers-reduced-motion: reduce` block that disables decorative transforms and looping ambient motion while retaining immediate state changes. In browser Performance tools, switch image/chat workspaces and open a 50-item history list; verify there is no repeated API load caused by layout toggling and no long task attributable to remapping the same collection on every keystroke.

- [ ] **Step 5: Run the complete automated suite**

Run:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: all tests pass, lint reports no errors, and the production build exits 0 without unresolved imports or route-handler type errors.

- [ ] **Step 6: Perform the manual regression matrix**

At each target width, verify:

- Login redirects to the image workspace and the existing visual identity is recognizable.
- Text-to-image, image editing, and reverse analysis preserve separate drafts while switching modes.
- Generation shows queued/running/success/failure states; insufficient credits are distinguishable from service errors.
- History grouping, local source-mode filtering, selection, details, download, reuse, and delete all work.
- Chat search/grouping, conversation switching, streaming, Enter submit, and Shift+Enter newline work.
- Admin browser navigation covers overview, users, site/content, and AI capability modules.
- User search/filter/sort and user detail tabs work; destructive actions require confirmation.
- Admin API keys can be created, enabled/disabled, deleted, and never re-reveal plaintext.
- User self-service API keys still work and cannot act on another user.
- Keyboard-only focus order is visible and logical; no fixed control obscures content.
- Text/background contrast passes WCAG AA in both themes, and reduced-motion mode removes decorative looping motion.

- [ ] **Step 7: Check the final diff for scope and accidental regressions**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: no whitespace errors, no unrelated user files staged, no server changes outside the approved API-key exception, and no dependency changes beyond restoring the declared `thinking-orbs` package.

- [ ] **Step 8: Commit final polish**

```powershell
git add src/app/globals.css src/components/Workspace/AppShell.tsx src/components/ImageGen/ImageGenView.tsx src/components/ImageGen/ImageMobileBar.tsx src/components/ImageGen/MobileDrawer.tsx src/components/ImageGen/AssetInspector.tsx src/components/Admin/AdminShell.tsx src/components/ConfirmDialog.tsx src/components/ApiKeysModal.tsx src/components/Header.tsx
git commit -m "fix: complete responsive and accessible workspace polish"
```

## Final Acceptance

The implementation is complete only when all automated commands pass and the manual regression matrix has been exercised. The resulting UI must make image generation visibly primary, keep chat as an independent focused workspace, turn administration into four clear modules, and provide administrator API-key management without broadening any other backend permission.
