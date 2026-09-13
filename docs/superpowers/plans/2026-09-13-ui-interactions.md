# Everyday UI Interactions Implementation Plan

> **For agentic workers:** Execute task-by-task with test-first changes and an independent review before release. Do not delegate critical-path implementation.

**Goal:** Deliver the six accepted everyday component/interaction improvements without changing billing or production data.

**Architecture:** Small native primitives and browser-action helpers feed existing React views. The existing native Dialog remains the modal foundation. Existing backend APIs and store/account epoch behavior are retained.

**Tech Stack:** Next.js 16.3.5, React 19.2.4, TypeScript, existing CSS tokens, node:test and Playwright.

## Global Constraints

No new production dependency. Preserve warm palette, current responsive breakpoints, shared image drafts and stop-generation behavior. No production builds or tests on the small server. All new behavior receives a failing test before implementation.

## Task 1 — Reproducible interactions

Files: create scripts/interaction-regressions.cjs; add test:interactions to package scripts; create src/lib/browser-actions.test.ts.

- [ ] Bundle actual components plus local fixtures, block external requests, expose controlled clipboard/fetch promises and streaming updates.
- [ ] Assert failures for premature copy/download success, IME Enter, auto-scroll stealing, menu dismissal, legacy modal Escape, toast visibility/persistence and credit-error action.
- [ ] Confirm the failures describe current behavior, not test setup errors.

## Task 2 — Browser actions and chat

Files: create src/lib/browser-actions.ts and src/hooks/useActionFeedback.ts; modify ImageGen/imageUtils.ts, ResultCanvas, ImagePreviewModal, ImageResultPanel, AssetInspector, ReversePromptPanel and Chat/ChatInput, ChatView.

Interfaces: copyText(text): Promise<void>; initiateImageDownload(url, filename): Promise<void>; useActionFeedback(scope).run(action, successText, fallbackError): Promise<boolean> with pending/success state and session invalidation.

- [ ] Implement minimal behavior to pass failed async tests; check HTTP/media before download, release object URLs later and never claim disk-save completion.
- [ ] Add IME guard and ref-based reader-controlled scrolling; scope copy state to message/conversation.
- [ ] Verify delayed/rejected operations and session/unmount handling; retain Enter/Shift+Enter/stop behavior.

## Task 3 — Native primitives and remaining main dialogs

Files: create components/ui/Button.tsx and Field.tsx; modify Toast, Settings/SettingsModal, CreditWalletModal, ApiKeysModal, DonationModal, ConfirmDialog, ImageGen/ImageActionMenu and globals.css.

- [ ] Add reusable controls using existing ui-button/ui-field tokens and 44px touch targets.
- [ ] Preserve native labels, aria-busy/invalid, focus return and nested confirmation behavior.
- [ ] Convert named dialogs; protect settings dirty state; invalidate late async replies after close.
- [ ] Implement transient success/persistent error toasts with dialog-local portal placement.
- [ ] Retest keyboard and pointer dismissal, nesting, close/reopen races and form state.

## Task 4 — Integration and release

Files: operation notes and verified release artifacts; no additional feature scope.

- [ ] Run npm test, typecheck, lint, test:uiux and test:interactions; 360/390/768/900/1024/1280/1440 screenshots and accessibility checks.
- [ ] Independent bounded review; fix meaningful regressions and repeat affected tests.
- [ ] Linux clean install/build and 300MiB runtime acceptance with disposable local data.
- [ ] Commit/push release branch, preserve local env/stash/master, package checksummed artifact.
- [ ] Validate current a4b06b1 production baseline, archive rollback, gate writes/drain/switch one service, validate public assets and memory, restore proxy.
- [ ] Observe stability, update outputs/report and never describe a blocked stage as complete.