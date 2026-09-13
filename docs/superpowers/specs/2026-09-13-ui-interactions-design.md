# Everyday UI component and interaction refinement

This is the second batch explicitly accepted by the user after the component/interaction assessment. Keep the deployed a4b06b1 responsive layout and warm palette. No component-library replacement or backend feature work.

## Accepted scope

1. Honest asynchronous feedback. Copy does not announce success before the clipboard resolves; rejection gives a useful persistent error. Image downloads check HTTP status and image content, do not save error bodies as PNG, prevent duplicate clicks while pending, and only announce that the browser download was initiated. Late completions after unmount/account change must not update a new session.
2. Chat interaction. Chinese IME Enter confirms composition without sending (including native keyCode 229 fallback). Enter sends and Shift+Enter inserts a newline outside composition. Streaming only follows when the reader is at the bottom; scrolling up pauses following, with an explicit return-to-latest button. Conversation changes reset follow state.
3. Consistent primitives. Reuse existing CSS tokens with small Button and labeled field components. Standardize loading/disabled/danger states, visible focus, and touch targets without adding production dependencies. Use them on the affected controls, not every admin screen.
4. Consistent dialogs and menus. Wallet, settings, API access, donation and chat preview use the proven native Dialog. Preserve async/session invalidation. Settings with unsaved edits require discard confirmation. The image action menu supports outside click, Escape, keyboard entry/return and does not intercept another top-layer dialog. Replace browser-confirm in the affected asset inspector with the native confirmation.
5. Actionable feedback. Success toasts are brief; errors remain dismissible until read, pause timed dismissal while hovered/focused, and remain visible above active dialogs. Image errors distinguish credits (open existing wallet), network and service failures; drafts remain editable without an automatic repeat of a charged operation.

## Constraints and validation

- No database schema, credentials, provider, billing, rate-limit or generation API changes.
- Tests use actual React components and synthetic in-memory network replies. Browser actions must not invoke paid providers or production users.
- Add failing node/browser checks before changes. Run existing regression suite, typecheck, lint and 7-width browser checks after integration.
- Preserve account epochs and existing stop-generation semantics. Respect reduced motion.
- Independent review before release. Linux build and runtime acceptance under 300MiB and zero swap locally; server receives only checksummed Linux artifact. Single application service, request drain, old release retained, proxy restored exactly.
- Existing JWT and port binding hardening remain separately scheduled, not silently bundled.