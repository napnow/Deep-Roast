# Changelog

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
