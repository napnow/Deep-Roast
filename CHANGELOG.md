# Changelog

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
