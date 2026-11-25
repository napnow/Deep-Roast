# Changelog

## 2026-11-25 — UI/UX polish, brand unification and reliability fixes

Production release: `/opt/deeproast-releases/20261125-uiux-polish-v2` (BUILD_ID `SocmThaY5YN_4ySqoQRDT`). Previous rollback target: `20261125-uiux-polish` → `20261124-image26-ratio`.

### Reliability fixes

- Batch image generation now sends a per-slot `Idempotency-Key` (`<key>:<index>`), eliminating `409 IDEMPOTENCY_IN_PROGRESS` collisions between parallel slots.
- Retrying after a server-side failure uses a fresh `Idempotency-Key`; network-level retries keep the original key so they can safely replay.
- Single shared `pg.Pool` (`globalThis` guard, `max 10`, idle/connection timeouts) to prevent pool leaks on hot reload.
- Merged duplicate `users` queries in session resolution into one `SELECT`.
- Memoized the 2.8 MB prompt-library snapshot normalization.
- `sharp.cache(false)` + `sharp.concurrency(1)` in crop path to keep RSS under `MemoryMax=300M`.
- Store selectors wrapped in `useShallow` to stop root re-renders on every keystroke; image history now paginates with “加载更多历史作品”.
- Includes the `image26-ratio` capability/crop changes already running in production since 2026-11-24.

### Visual & UX

- Unified light “暖调画廊白” and dark “深焙暗房” tokens across Studio, Chat, Login, Canvas, Admin and all modals.
- Puppy brand mark (`brand-mark.png`) everywhere: top bar, mobile drawer, boot screen, chat empty state, canvas top bar, admin sidebar; new rounded favicons/PWA icons (`?v=puppy`).
- Replaced scattered emoji / text glyphs with a unified stroke icon set (`AppIcon`).
- Studio: removed the redundant kicker badge; mobile hides the inspiration example cards; style menu de-duplicated (single “无预设”); composer toolbar wraps instead of overflowing with long model names (character counter only shown at ≥ 500 chars).
- Infinite canvas: removed the prompt-library feature and placeholder toolbar buttons; added credit pill and theme toggle; removed accidental-click logout.
- Admin console: unified layout across all five modules, sticky breadcrumb top bar with refresh/theme toggle, grouped site settings with inline status, fixed negative credit input, Esc closes all admin modals.
- Inline conversation rename (no `window.prompt`), session-once skippable login intro, accessible dialogs.

### Verification

- `tsc --noEmit` 0 errors, ESLint 0 errors, `npm test` 571 pass / 6 DB-integration skipped, `test:uiux` 25/25, `test:interactions` 27/27, `next build` OK.
- Post-deploy browser check on `https://deeproast.sryze.cc` (desktop 1280/820 px, mobile 390 px, light & dark): 0 console errors.
- See `docs/operations/uiux-polish-release-2026-11-25.md` for deployment and rollback details.

## 2026-09-04 — Full production version recovery

### Restored product features

- Restored the complete mobile workspace and mobile administrator console from the preserved pre-hardening production source.
- Restored administrator-controlled registration IP limits, user/admin API Key management, multi-channel model routing, and announcement QR images.
- Restored the production image editing, invitation, donation, check-in, chat-history, and responsive administration flows that were absent from the incomplete Git snapshot.

### Security retained

- Kept authenticated private-image delivery, administrator owner-scoped image access, durable request idempotency, transactional credit reservations, bounded upstream requests, and public-HTTPS SSRF validation.
- Kept AES-256-GCM storage for user API Keys and the primary LLM Key, and extended the same encrypted-at-rest policy to model-channel API Keys.
- Restored bounded auth payloads, private legacy-image blocking, mandatory administrator seed passwords, signed v1 image URLs, and durable idempotency after an independent recovery review caught merge regressions.
- Added DNS-pinned, backpressure-aware outbound POST/stream transports for configurable channels, fail-closed channel routing, atomic channel/config updates, and transactional default-on registration IP enforcement.
- Preserved original error status during idempotent replay, refreshed signed v1 image URLs on replay, and propagated chat-image cancellation through the upstream call and credit refund path.
- Added fenced idempotency leases, stopped expired claims from being re-executed, and committed assistant messages with successful idempotency outcomes in one transaction.
- Preserved explicitly empty channel configurations through the browser and disabled chat/image actions when administrators have enabled no default model.
- Moved announcement QR, administrator contact, and donation uploads into the persistent data directory so immutable release switches do not discard them; public asset routes require a live database association.
- Added additive migrations `0021_model_channels.sql`, `0022_announcement_qr_image.sql`, and `0023_idempotency_leases.sql`; none drops or rebuilds production tables.

### Verification

- Passed all 249 Node tests, TypeScript checking, ESLint with zero warnings, and the default Next.js 16.3.2 Turbopack production build.
- See `docs/operations/production-version-recovery-2026-09-04.md` for the exact migration, deployment, verification, and rollback procedure.

## 2026-09-02 — Security hardening and repository cleanup

### Security and reliability

- Added durable request idempotency for chat, text-to-image, image-to-image, batch image editing, and the v1 image gateway.
- Moved new generated images outside `public/`, added authenticated ownership checks, and kept legacy image records behind the protected image route.
- Encrypted the administrator LLM API key with AES-256-GCM and added the migration command for legacy plaintext configuration.
- Closed administrator, model-catalog SSRF, credit-transaction, upstream-timeout, and private-image access gaps.

### Operations

- Added migrations `0018_request_idempotency_and_private_images.sql` and `0019_encrypt_llm_config_key.sql`.
- Added `docs/security-hardening.md` and `docs/operations/private-image-migration.md` with deployment, rollback, and environment-variable guidance.

## 2026-08-23 — Production security hardening

### Security and request boundaries

- Added bounded JSON request parsing and safer public error responses so internal provider and server details are not exposed to clients.
- Isolated model-catalog credentials, enforced enabled-model access, and added SSRF protections for outbound URLs and image downloads.
- Hardened chat and image service boundaries, including input-size limits, download validation, timeout handling, and safer upstream error mapping.
- Added application and reverse-proxy security headers, disabled the framework-identifying response header, and constrained proxy request sizes.

### Credit and data integrity

- Added atomic, durable credit reservations for chat and image operations, including precharge, settlement, and failure refunds.
- Added a persistent reservation identity to prevent duplicate credit operations during retries or concurrent requests.
- Added migrations `0015_checkin_reward.sql` and `0016_credit_reservation_identity.sql`.
- Made the daily check-in reward configurable from the admin settings and propagated the configured value through the API and user interface.

### Runtime and deployment

- Upgraded Next.js to 16.3.2 and Sharp to 0.35.3, refreshed the lockfile, and pinned the transitive Nano ID security override.
- Added versioned release directories with an atomic current-release symlink for safer deployments and rollback.
- Moved the application service to a dedicated low-privilege user with `NoNewPrivileges`, `PrivateTmp`, restart limits, and a memory cap.
- Added Cloudflare-only origin routing, trusted-proxy handling, Caddy security headers, and a persistent firewall service for published Docker ports.

### User-facing updates

- Added a donation shortcut in the main header when donation support is enabled.
- Updated wallet and sign-in state so the configured check-in reward is shown consistently before and after check-in.

### Upgrade notes

- Back up PostgreSQL data and uploaded images before applying the migrations.
- Install from the lockfile, run migrations and verification checks, build a fresh production bundle, then restart the application and proxy services.
- Review the supplied files under `ops/` before installing systemd, Caddy, or firewall configuration on a different host.

## 2026-08-22 — Invitation, announcements, and image editing

### User-facing updates

- Added end-to-end user invitations, including invitation links, invitation history, configurable rewards, and invitee rewards.
- Shortened newly generated invitation codes while preserving compatibility with legacy invitation links.
- Added an announcement bell with unread state and an announcement panel that works across desktop and mobile layouts.
- Refined the image-editing workbench with resizable panels, clearer input modes, mobile improvements, and a more consistent creation flow.
- Added support for per-image editing and target-image/reference-image editing, with batch results and partial-success reporting.

### Admin and API updates

- Added invitation management and reward configuration to the admin area.
- Added invitation-related registration and user APIs.
- Hardened invitation settings and history browsing.
- Refined image-editing endpoints, task handling, upstream error boundaries, and provider behavior.

### Data and reliability

- Added database migrations for the invitation system, short invitation codes, and invitee rewards:
  `0012_invitation_system.sql`, `0013_short_invitation_codes.sql`, and
  `0014_invitee_invitation_reward.sql`.
- Added and updated regression coverage for invitations, announcements, image-editing contracts and tasks, rate limits, provider behavior, and migration/seed policies.
- Added deployment hardening and verification checks.

### Documentation and deployment notes

- Refreshed the README and environment-variable guidance.
- Before deploying, run the database migrations, build the production bundle, and restart the application:

  ```bash
  npm run db:migrate
  npm run build
  npm start
  ```

- Keep production secrets out of Git and verify that the production build contains the latest source changes before restarting.
