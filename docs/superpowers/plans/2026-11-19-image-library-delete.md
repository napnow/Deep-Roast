# 作品库删除与版本组 Implementation Plan

> **For agentic workers:** Inline execution is used in this session; complete each task with its test cycle before moving on.

**Goal:** Add safe image-library multi-delete with explicit single-image and whole-version-group semantics.

**Architecture:** Add owner-scoped batch and version-group deletion helpers in the image service and route, then extend the existing desktop/mobile gallery components with a shared selection state and confirmation actions. Canvas layout revalidation already removes stale nodes; successful deletion results will refresh client history.

**Tech Stack:** Next.js App Router, React, Drizzle/PostgreSQL, Node test runner, TypeScript.

## Global Constraints

- Default bulk deletion only removes explicitly selected image IDs.
- Whole-version-group deletion requires an explicit confirmation action.
- Every deletion is owner-scoped and returns partial success details.
- Do not commit AGENTS.md, storage, .release-work, .isolated, or .npm-cache.

### Task 1: Owner-scoped deletion service and API

**Files:**
- Modify: `src/server/services/image.ts`
- Create: `src/server/services/image-bulk-deletion.test.ts`
- Create: `src/app/api/image-history/batch/route.ts`
- Create: `src/app/api/image-history/version-group/[groupId]/route.ts`

**Interfaces:**
- Produce `deleteImageRecords(userId, ids)` returning `{ deletedIds: string[]; failedIds: string[] }`.
- Produce `deleteImageVersionGroup(userId, groupId)` returning the same shape.
- `POST /api/image-history/batch` accepts `{ ids: string[] }`.
- `DELETE /api/image-history/version-group/[groupId]` deletes the authenticated owner’s group.

- [ ] Write failing tests for owner filtering, duplicate IDs, partial missing records, and group deletion.
- [ ] Run `node --import tsx --test src/server/services/image-bulk-deletion.test.ts` and observe failures.
- [ ] Implement transactional owner-scoped record deletion, collect file paths, delete database rows before best-effort file cleanup, and return partial results.
- [ ] Add route validation and `requireActiveUser` protection.
- [ ] Run the focused service and route tests until green.

### Task 2: Shared gallery selection UI

**Files:**
- Modify: `src/components/ImageGen/GalleryTab.tsx`
- Modify: `src/components/ImageGen/ImageHistoryPanel.tsx`
- Modify: `src/components/ImageGen/ImageGenView.tsx`
- Create: `src/components/ImageGen/image-library-selection.test.ts`

**Interfaces:**
- Both gallery surfaces consume a shared selection state from `ImageGenView`.
- Selection actions call a single `onBatchDelete(ids, mode)` callback where mode is `selected` or `version-group`.

- [ ] Write failing UI contract tests for entering selection mode, select-all, cancel, selected count, and explicit whole-group action.
- [ ] Run the focused UI contract test and observe failures.
- [ ] Implement the shared selection state and accessible checkbox buttons without changing preview behavior.
- [ ] Add confirmation text showing selected count and group count; default action remains selected-only.
- [ ] Run the focused UI tests until green.

### Task 3: Client deletion flow and refresh

**Files:**
- Modify: `src/components/ImageGen/ImageGenView.tsx`
- Modify: `src/hooks/useImageActions.ts`
- Modify: `src/hooks/useInitialData.ts`
- Modify: `src/components/ImageGen/image-library-selection.test.ts`

**Interfaces:**
- `onBatchDelete` calls the batch route for selected mode and the version-group route for group mode.
- Successful IDs are removed from client history; failed IDs remain and show an error toast.

- [ ] Add failing tests for partial success, current-image deletion, and no duplicate requests.
- [ ] Implement bounded batch requests, success-only local removal, and reload fallback when the current image is deleted.
- [ ] Run focused tests and then `npm run typecheck`.

### Task 4: Regression validation and release preparation

**Files:**
- Modify: `scripts/interaction-regressions.cjs`
- Modify: `scripts/uiux-regressions.cjs`
- Modify: `src/server/services/image-deletion-safety.test.ts`

- [ ] Add browser checks for desktop and mobile selection, confirmation, selected-only delete, and group delete.
- [ ] Run `npm test`, `npm run typecheck`, lint, UIUX, and interaction regressions.
- [ ] Review `git diff --check` and the staged allowlist.
- [ ] Commit the feature separately from deployment artifacts.