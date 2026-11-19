# Infinite Canvas Generation Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-slot generation queue to the infinite canvas with per-node stage/elapsed status, cancellation, retry, and accessible queue feedback while preserving existing result and connection behavior.

**Architecture:** Keep generation task state inside `InfiniteImageCanvas` through a focused queue hook/module keyed by `nodeId`. The queue starts at most two jobs, passes an `AbortSignal` into the existing page-level API callback, and exposes immutable task snapshots to node renderers and a compact queue summary. The page remains responsible for image API calls, library updates, and result IDs; the canvas remains responsible for scheduling, cancellation, and node-local status.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, `@xyflow/react`, existing `ImageGenStageIndicator`, `formatTime`, Node test runner with `tsx`, Playwright smoke scripts.

## Global Constraints

- Keep the server image concurrency limit at 2; do not change `src/server/services/image-concurrency.ts`.
- Do not persist in-flight generation state in `image_canvas_layouts`; only persisted nodes, edges, and viewport survive refresh.
- Do not invent percentage or remaining-time progress; show stage estimates and elapsed time only.
- Preserve existing image-library writes, version lineage, canvas connections, and partial-success behavior.
- Do not include unrelated worktree changes for image-library deletion in this feature commit.

---

### Task 1: Define and test the canvas generation queue

**Files:**
- Create: `src/components/ImageGen/canvas-generation-queue.ts`
- Test: `src/components/ImageGen/canvas-generation-queue.test.ts`

**Interfaces:**
- Consumes: a `nodeId`, requested count, and async runner that accepts an `AbortSignal`.
- Produces: task snapshots keyed by `nodeId`, queue order, start/cancel/retry operations, and a `dispose()` method that aborts active work.

- [ ] **Step 1: Write failing queue behavior tests**

Cover these exact behaviors with the Node test runner:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { createCanvasGenerationQueue } from "./canvas-generation-queue";

test("starts only two jobs and promotes the next queued node", async () => {
  const started: string[] = [];
  const finishers = new Map<string, () => void>();
  const queue = createCanvasGenerationQueue({ limit: 2 });
  const run = (nodeId: string) => (_signal: AbortSignal) => new Promise<string>(resolve => {
    started.push(nodeId);
    finishers.set(nodeId, () => resolve(nodeId));
  });
  queue.enqueue({ nodeId: "a", count: 1, run: run("a") });
  queue.enqueue({ nodeId: "b", count: 1, run: run("b") });
  queue.enqueue({ nodeId: "c", count: 1, run: run("c") });
  await Promise.resolve();
  assert.deepEqual(started, ["a", "b"]);
  assert.equal(queue.get("c")?.status, "queued");
  finishers.get("a")!();
  await queue.whenIdle("a");
  await Promise.resolve();
  assert.deepEqual(started, ["a", "b", "c"]);
});

test("cancelling a queued job never calls its runner", async () => {
  let called = false;
  const queue = createCanvasGenerationQueue({ limit: 1 });
  queue.enqueue({ nodeId: "a", count: 1, run: async () => new Promise(() => {}) });
  queue.enqueue({ nodeId: "b", count: 1, run: async () => { called = true; return []; } });
  assert.equal(queue.cancel("b"), true);
  assert.equal(called, false);
  assert.equal(queue.get("b")?.status, "cancelled");
});

test("active cancellation aborts only its own signal and records cancellation", async () => {
  let aborted = false;
  const queue = createCanvasGenerationQueue({ limit: 2 });
  queue.enqueue({ nodeId: "a", count: 1, run: signal => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("cancelled")); }, { once: true });
  }) });
  await Promise.resolve();
  assert.equal(queue.cancel("a"), true);
  await queue.whenIdle("a");
  assert.equal(aborted, true);
  assert.equal(queue.get("a")?.status, "cancelled");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test src/components/ImageGen/canvas-generation-queue.test.ts`

Expected: FAIL because the queue module and behavior do not exist.

- [ ] **Step 3: Implement the minimal queue**

Implement `createCanvasGenerationQueue({ limit = 2, onChange })` with:

```ts
export type CanvasGenerationTaskStatus = "queued" | "generating" | "success" | "error" | "cancelled";
export type CanvasGenerationTask = {
  taskId: string;
  nodeId: string;
  status: CanvasGenerationTaskStatus;
  queuedAt: number;
  startedAt?: number;
  elapsedSeconds: number;
  count: number;
  completed: number;
  failed: number;
  error?: string;
};
export type CanvasGenerationJob = {
  nodeId: string;
  count: number;
  run: (signal: AbortSignal) => Promise<{ completed: number; failed: number; error?: string }>;
};
```

The scheduler must reject duplicate `nodeId` jobs while a task is queued or generating, start jobs FIFO up to `limit`, update elapsed seconds from one timer, promote the next job after terminal state, and treat an `AbortError`, status 499, or `IMAGE_GENERATION_CANCELLED` as `cancelled`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same command. Expected: all queue tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ImageGen/canvas-generation-queue.ts src/components/ImageGen/canvas-generation-queue.test.ts
git commit -m "feat(canvas): add bounded generation queue"
```

### Task 2: Add node status rendering and queue summary components

**Files:**
- Create: `src/components/ImageGen/CanvasGenerationStatus.tsx`
- Create: `src/components/ImageGen/CanvasGenerationQueueSummary.tsx`
- Test: `src/components/ImageGen/canvas-generation-status.test.ts`
- Modify: `src/app/studio-preview.css`

**Interfaces:**
- Consumes: `CanvasGenerationTask`, `onCancel`, `onRetry`, and `onDismiss` callbacks.
- Produces: an accessible node overlay and a compact expandable queue summary.

- [ ] **Step 1: Write failing rendering contract tests**

Assert the source/component contract includes:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("generation status reuses staged indicator and exposes cancellation", () => {
  const source = readFileSync(new URL("./CanvasGenerationStatus.tsx", import.meta.url), "utf8");
  assert.match(source, /ImageGenStageIndicator/);
  assert.match(source, /formatTime/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /停止生成/);
});

test("queue summary exposes queued and active counts", () => {
  const source = readFileSync(new URL("./CanvasGenerationQueueSummary.tsx", import.meta.url), "utf8");
  assert.match(source, /正在生成/);
  assert.match(source, /排队/);
  assert.match(source, /role="status"/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test src/components/ImageGen/canvas-generation-status.test.ts`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the node overlay**

`CanvasGenerationStatus` must:

- Render `ImageGenStageIndicator elapsedSeconds={task.elapsedSeconds}` for `generating`.
- Render “排队中” plus queue position for `queued`.
- Render `task.error`, “重新生成”, and “移除状态” for `error`.
- Render “已生成 N 张” or “已取消” for terminal states.
- Use `role="status" aria-live="polite"`; use an assertive error region only for the error message.
- Keep controls as real `button type="button"` elements with labels.

- [ ] **Step 4: Implement the queue summary**

Render nothing when there are no non-terminal tasks. Otherwise render a bottom canvas bar with active count, queued count, and an expandable task list. Each item shows a prompt summary, elapsed time, and node-local cancel/retry action. The summary must not intercept canvas panning except while its own controls are focused.

- [ ] **Step 5: Add the visual states**

Add scoped CSS classes in `src/app/studio-preview.css` for:

- Empty-node waiting card.
- Existing-image dimmed overlay.
- Queued badge.
- Error/retry state.
- Bottom queue bar and expanded list.
- `:focus-visible` outlines and mobile-safe max widths.

Do not change the existing canvas toolbar or node dimensions outside the status overlay.

- [ ] **Step 6: Run tests and commit**

Run: `node --import tsx --test src/components/ImageGen/canvas-generation-status.test.ts`

Expected: PASS.

```bash
git add src/components/ImageGen/CanvasGenerationStatus.tsx src/components/ImageGen/CanvasGenerationQueueSummary.tsx src/components/ImageGen/canvas-generation-status.test.ts src/app/studio-preview.css
git commit -m "feat(canvas): add generation status surfaces"
```

### Task 3: Thread cancellation through the page generation callback

**Files:**
- Modify: `src/components/ImageGen/InfiniteImageCanvas.tsx`
- Modify: `src/components/ImageGen/CanvasPromptPanel.tsx`
- Modify: `src/app/studio/canvas/page.tsx`
- Modify: `src/lib/canvas-generation.ts`
- Test: `src/lib/canvas-generation.test.ts`

**Interfaces:**
- Consumes: queue jobs from Task 1 and status callbacks from Task 2.
- Produces: `CanvasGenerateContext` with `signal: AbortSignal`; all image requests use that signal.

- [ ] **Step 1: Add failing cancellation tests**

Extend `src/lib/canvas-generation.test.ts` with tests that a variant runner receives the signal and stops scheduling new variants after abort:

```ts
test("canvas variant requests pass the abort signal and stop queued variants", async () => {
  const controller = new AbortController();
  let calls = 0;
  const result = await settleCanvasVariantRequests(5, signal => {
    calls += 1;
    assert.equal(signal, controller.signal);
    controller.abort();
    return Promise.reject(Object.assign(new Error("cancelled"), { name: "AbortError" }));
  }, controller.signal);
  assert.equal(calls, 1);
  assert.equal(result.values.length, 0);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test src/lib/canvas-generation.test.ts`

Expected: FAIL because `settleCanvasVariantRequests` does not accept or propagate a signal.

- [ ] **Step 3: Update the callback contracts**

Change the canvas callback type to accept a context object:

```ts
export type CanvasGenerateContext = { signal: AbortSignal };
type CanvasGenerateHandler = (
  nodeId: string,
  prompt: string,
  references: CanvasPromptReference[],
  settings: CanvasPromptPanelSettings,
  targetImage: ImageRecord | null,
  context: CanvasGenerateContext,
) => void | string[] | Promise<void | string[]>;
```

Pass `context.signal` from `CanvasPromptPanel` through `generateForNode` into the page handler. Replace the panel-local `busy` gate with a controlled `isGenerating` prop from the task map; close the panel after a successful enqueue, while allowing the node overlay to remain visible.

- [ ] **Step 4: Thread the signal through request helpers**

Update `settleCanvasVariantRequests(count, request, signal?)` so each `request(signal)` receives the same signal and the worker loop stops starting new work after abort. Add `signal` to every `apiJson` RequestInit in `handleGenerate`, including `/api/image`, `/api/image-edit`, and `/api/image-edit/batch`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --import tsx --test src/lib/canvas-generation.test.ts`

Expected: all existing and new tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ImageGen/InfiniteImageCanvas.tsx src/components/ImageGen/CanvasPromptPanel.tsx src/app/studio/canvas/page.tsx src/lib/canvas-generation.ts src/lib/canvas-generation.test.ts
git commit -m "feat(canvas): propagate generation cancellation"
```

### Task 4: Integrate queue state into React Flow without rebuilding positions

**Files:**
- Modify: `src/components/ImageGen/InfiniteImageCanvas.tsx`
- Modify: `src/components/ImageGen/CanvasGenerationStatus.tsx`
- Modify: `src/components/ImageGen/CanvasGenerationQueueSummary.tsx`
- Test: `src/components/ImageGen/infinite-canvas-generation.test.ts`

**Interfaces:**
- Consumes: queue API from Task 1, status components from Task 2, and signal-aware callback from Task 3.
- Produces: node-local task overlays, queue summary, cancel/retry actions, and late-result protection.

- [ ] **Step 1: Write failing integration tests**

Add source/behavior tests covering:

```ts
test("canvas passes a node task signal and exposes queue summary", () => {
  const source = readFileSync(new URL("./InfiniteImageCanvas.tsx", import.meta.url), "utf8");
  assert.match(source, /createCanvasGenerationQueue/);
  assert.match(source, /CanvasGenerationQueueSummary/);
  assert.match(source, /CanvasGenerationStatus/);
  assert.match(source, /AbortController/);
});

test("deleting a generating node ignores late generated ids", () => {
  // Use the extracted late-result guard helper and assert deleted node IDs are discarded.
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test src/components/ImageGen/infinite-canvas-generation.test.ts`

Expected: FAIL because queue integration and late-result guard are absent.

- [ ] **Step 3: Integrate the queue**

Create one queue instance per mounted canvas with `limit: 2`. On submit, enqueue a job that calls the parent `onGenerate` with its task signal. Store task snapshots in React state, but update only the affected node data when the timer changes; keep `nodesRef` positions and React Flow identity stable.

- [ ] **Step 4: Render node-local status**

Add `generationTask?: CanvasGenerationTask` to image/text node data. Render `CanvasGenerationStatus` inside each node. Disable duplicate submit for a node with an active or queued task. On success, clear the task after the short success acknowledgment while preserving the generated node/edge update.

- [ ] **Step 5: Add cancellation, retry, and deletion guards**

- Cancel queued tasks without invoking the parent.
- Cancel active tasks through the stored controller.
- Retry an error by enqueueing a new task with the saved prompt, references, and settings.
- When `remove(nodeId)` runs, cancel and remove that node’s task.
- When a late result returns, ignore it if the node was deleted or the task ID is no longer current.
- Keep server-persisted generated images in the parent image list even when their canvas source node was removed.

- [ ] **Step 6: Render the queue summary and verify GREEN**

Render `CanvasGenerationQueueSummary` once inside the canvas root, outside React Flow’s node layer. Run the focused integration test and expect PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ImageGen/InfiniteImageCanvas.tsx src/components/ImageGen/CanvasGenerationStatus.tsx src/components/ImageGen/CanvasGenerationQueueSummary.tsx src/components/ImageGen/infinite-canvas-generation.test.ts
 git commit -m "feat(canvas): integrate bounded generation queue"
```

### Task 5: Run full regression coverage and review the final diff

**Files:**
- Modify only files required by failing tests from Tasks 1–4.
- Test: existing unit, UIUX, interaction, and infinite canvas smoke suites.

- [ ] **Step 1: Run type and lint checks**

```bash
npm run typecheck
npm run lint -- --ignore-pattern '.release-work/**' --ignore-pattern '.isolated/**' --ignore-pattern 'storage/**'
```

Expected: typecheck passes; lint has no errors and only the project’s existing warnings.

- [ ] **Step 2: Run all unit tests**

```bash
npm test
```

Expected: all tests pass with only the existing conditional skips.

- [ ] **Step 3: Run browser regressions with local Chrome**

```powershell
$env:BROWSER_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:uiux
npm run test:interactions
node scripts/infinite-canvas-smoke.cjs
$env:CANVAS_OLD_TARGET_TEST='1'; node scripts/infinite-canvas-smoke.cjs
$env:CANVAS_CAPACITY_TEST='1'; node scripts/infinite-canvas-smoke.cjs
```

Expected: all existing scenarios pass, plus the new queue scenarios: two active/one queued, queued cancellation, active cancellation, independent failure, retry, and late-result deletion protection.

- [ ] **Step 4: Review the diff boundary**

Run:

```bash
git diff --check HEAD~5..HEAD
git status --short
```

Confirm no `.env`, `storage`, `.release-work`, `.isolated`, screenshots, or unrelated image-library deletion files are staged.

- [ ] **Step 5: Commit the final test fixes**

```bash
git add src/components/ImageGen/canvas-generation-queue.ts src/components/ImageGen/canvas-generation-queue.test.ts src/components/ImageGen/CanvasGenerationStatus.tsx src/components/ImageGen/CanvasGenerationQueueSummary.tsx src/components/ImageGen/canvas-generation-status.test.ts src/components/ImageGen/InfiniteImageCanvas.tsx src/components/ImageGen/CanvasPromptPanel.tsx src/app/studio/canvas/page.tsx src/lib/canvas-generation.ts src/lib/canvas-generation.test.ts src/app/studio-preview.css src/components/ImageGen/infinite-canvas-generation.test.ts
git commit -m "test(canvas): cover concurrent generation states"
```

- [ ] **Step 6: Request code review before merge**

Use the requesting-code-review skill against the feature base and final commit. Resolve all Critical and Important findings before deployment.
