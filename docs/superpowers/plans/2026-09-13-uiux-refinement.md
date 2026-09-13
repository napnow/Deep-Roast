# DeepRoast UI/UX Refinement Implementation Plan

> **For agentic workers:** Execute inline task-by-task; obtain independent review at the release checkpoint.

**Goal:** Finish the approved first-batch Web, tablet and phone refinements with regression evidence.

**Architecture:** Reuse existing Zustand drafts and pricing. Extract a small native-dialog component; make inspector presentation responsive without changing its data flow.

**Tech Stack:** Next.js 16.3.x, React 19.2.4, TypeScript, node:test, Playwright.

## Global Constraints
Preserve warm paper/caramel style, account isolation, billing semantics, environment files, master, stash and rollback. No production test data or paid requests.

### Task 1: Shared modal behavior
Files: src/components/ui/Dialog.tsx; ConfirmDialog.tsx; ImageGen/ImagePreviewModal.tsx; Auth/ChangePasswordModal.tsx; ImageGen/ImageMobileBar.tsx; app/globals.css.
Interface: Dialog({ open, onClose, label, className, children }). Existing caller props remain stable.
- [ ] Browser red: close button wins hit testing, Escape closes only top modal, Tab stays inside, focus returns to opener.
- [ ] Implement native dialog via document.body portal and reference-counted scroll lock; keep onClose in a ref so rerenders do not reopen/focus.
- [ ] Convert preview, confirmation, password and mobile sheets; label password inputs.
- [ ] Browser green plus existing modal/lifecycle regression suites.

### Task 2: Responsive layout and shared draft
Files: ImageGen/ImageGenView.tsx; AssetInspector.tsx; creation-workbench-ui.ts and tests; ImageMobileBar.tsx; CreationPanel.tsx; ResultCanvas.tsx; app/globals.css.
Interface: existing textToImageDraft, setTextToImageDraft, onGenerate(prompt, size, count).
- [ ] Browser red: canvas usable at 768/900/1024 with persisted 560px panel; history still accessible.
- [ ] Browser red: mobile prompt and size survive desktop roundtrip and simulated 503; quantity/style match across surfaces.
- [ ] Replace duplicate mobile state with store selectors; remove submit-time clearing; preserve style composition.
- [ ] Add compact bounds and history drawer for narrow desktop without destroying wide inspector preference.
- [ ] Green across 360/390/768/900/1024/1280/1440 widths and account/stop/partial-result regressions.

### Task 3: Model/cost clarity and editing density
Files: ImageMobileBar.tsx; CreationPanel.tsx; TextToImageForm.tsx; Img2ImgPanel.tsx; image-model-presentation.ts and tests; globals.css.
Interface: server-provided imageModelCosts stays authoritative; no new backend calculator.
- [ ] Browser red: model, quantity, total cost and balance fit at 360px without horizontal scrolling.
- [ ] Show a named model picker with raw-ID fallback and per-image cost; expose count beside size; full-width generation button shows total.
- [ ] Compact uploaded refs and secondary mode copy; keep modification prompt prominent and advanced settings available.
- [ ] Green including upload cancellation/account reset and failed generation retaining editable prompt.

### Task 4: Validation and delivery
- [ ] Full node:test, TypeScript, ESLint, production dependency advisory check and offline builds.
- [ ] Browser tests with synthetic data: all viewports, light/dark, nested dialogs, retry drafts and account isolation. Inspect actual screenshots.
- [ ] Independent review and fixes; repeat affected checks.
- [ ] Commit/push isolated release branch; checksum exact artifact; verify production baseline before any reversible switch.
- [ ] Preserve rollback, synchronize clean local project without replacing env/stash/master; report remaining security and physical-device limits.