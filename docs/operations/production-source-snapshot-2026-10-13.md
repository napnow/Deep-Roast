# Production Source Snapshot: 2026-10-13

This branch preserves the source present in the active production release on
2026-10-13. It is an archival branch, not a deployment or migration approval.

## Provenance

- Public base: `a563f1bf80c6dcda65362d3d335798e02897360e` (`master`).
- Release manifest commit: `c5d242b53668457b3fda0d44f9dbb999b495e797`.
- Existing build ID: `5Ex1Ho9sOeIZowT2d-Sze`.
- Five source files differ from their release-manifest hashes:
  `ImageMobileBar.tsx`, `Img2ImgPanel.tsx`, `TextToImageForm.tsx`,
  `image-prompt-limit.test.ts`, and `src/server/services/image.ts`.

The source currently specifies an 8000-character image prompt limit. The
preserved build predates those source edits. Matching build IDs do not establish
that this build implements the current source. No production rebuild was run.

## Private Preservation

The complete release archive includes the existing `.next` build and Linux
dependencies. Environment/service configuration, PostgreSQL custom-format dump,
and database roles are stored separately outside Git in restricted local storage.
SHA-256 checksums, full archive reads, and a successful `pg_restore --list` check
were recorded privately. A restore into an isolated database has not been tested.
Persistent user images/uploads are not included in this source/build/DB snapshot;
a complete disaster-recovery backup additionally requires the persistent data
directories and any other service data.

## Publication Boundary

Only source, migrations, scripts, public font assets and licenses, safe templates,
and operational documentation belong in this branch. Runtime configuration,
database data, generated media, `.next`, dependencies, original deployment
manifest, and private snapshots are excluded. Previously tracked internal agent
notes and obsolete source backups are removed from the branch tip. Existing
public Git history is not rewritten.

Production-config fingerprints and significant database values were compared
locally against the publication tree. Matching built-in example/default prompts
are application source, not an export of user records. An obsolete default
password reference is removed; credentials matching historical public literals
must still be rotated separately through a controlled operations procedure.

## Validation And Known Risk

- Unit/contract tests: 393 passed, 1 skipped, 0 failed.
- Type checking: passed using existing local dependencies.
- No production database migrations, service restarts, or deployment changes.
- Database-backed integration and end-to-end generation are not certified here.
- Existing pricing lookup behavior falls back to the default price on any
  database error. This can undercharge when configured pricing is unavailable.
  Preserve it for source fidelity; review and fix before approving deployment.

Before deploying this branch, review schema/bootstrap operations, test a database
restore, rebuild with clean locked dependencies, and validate generation and
credit accounting against an isolated environment.
