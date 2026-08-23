# Production Hardening Review Remediation Design

**Date:** 2026-08-23

## Goal

Close the important findings from the production-hardening review before publishing
the branch to GitHub, without changing the live release in place.

## Decisions

1. Add the five missing query indexes in a new additive migration
   `0017_security_performance_indexes.sql`; the already-applied
   `0016_credit_reservation_identity.sql` remains immutable.
2. Keep the chat timeout active until the upstream response body is fully consumed,
   and clear it in a `finally` block. Client cancellation aborts both fetch and
   reader consumption.
3. Make check-in and administrator balance adjustments update the balance and
   append the matching ledger row inside one Drizzle transaction.
4. Write generated images and thumbnails to exclusive temporary files in their
   target directories, flush and close them, then atomically rename them to their
   final paths. Cleanup is limited to paths created by the current attempt.
5. Make Caddy strip inbound client-IP headers and rebuild a canonical address from
   the trusted proxy chain. The application trusts only the canonical header.
6. Add regression coverage for migration contracts, proxy configuration, timeout
   lifetime, atomic artifact writes, and credit transaction boundaries. PostgreSQL
   integration tests run when a test database is explicitly configured; unit and
   source-contract tests remain safe for the default test command.

## Non-goals

- No force-push or merge into `master`.
- No in-place build or source mutation of the active release while the service is
  running.
- No unrelated UI, dependency, or historical image changes.

## Verification

The disposable worktree must pass the focused tests, `npm test`, TypeScript
checking, modified-file ESLint, dependency audit, build, and staged-diff hygiene
checks before the branch is pushed.
