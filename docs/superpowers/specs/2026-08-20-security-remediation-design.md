# Deeproast Security Remediation Design

## Goal

Close the critical authorization and secret-exposure paths, prevent API-driven image-credit races, and harden API-key issuance without touching environment files or unrelated features.

## Scope

- Await administrator authorization before any configuration write.
- Keep `JWT_SECRET` server-only; do not inject it into the browser build.
- Reserve image credits atomically before upstream generation, then refund on a failed generation.
- Do not retry an insufficient-credit error.
- Cap and rate-limit API-key creation; prevent caching of the one-time plaintext response.
- Return safe upstream error messages, validate image sizes, and build result URLs from a configured public origin.

## Approach

Use focused server-side changes that preserve the existing route and database patterns. Credit reservation will use an atomic conditional database update before the upstream call, with an explicit compensating refund only for failed upstream work. API-key restrictions will be enforced at the service boundary so all callers share the policy.

## Safety and Deployment

- Do not read, copy, or modify `.env*` files.
- Synchronize only changed source and test files to `D:\工作\深焙-app`.
- Before overwriting a changed local target, create a timestamped `.bak` copy beside it.
- Verify with focused tests, lint/type checks, and a production build before synchronization.
- After deployment, rotate `JWT_SECRET` and all upstream provider keys, then inspect request logs for historical `PUT /api/config` calls.

## Acceptance Criteria

- A rejected admin request cannot reach config mutation logic.
- The browser build configuration contains no `JWT_SECRET` mapping.
- Concurrent image requests cannot consume more successful upstream generations than reserved credits.
- A user cannot create more than ten active API keys or create them without rate control.
- One-time API-key creation responses are not cacheable.
