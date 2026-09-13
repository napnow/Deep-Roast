# Small-server production release procedure

The production host has about 843 MiB of RAM and the application service is limited to 300 MiB. Never install dependencies, run the test suite, or build Next.js on this host.

## Build and acceptance

1. Use an isolated Linux x86_64 build machine compatible with the production glibc. Use Node.js 22.22 or newer in the same supported LTS line and `npm ci`, not copied Windows dependencies.
2. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. The lockfile now consistently installs Next.js 16.3.2, React 19.2.4, Sharp 0.35.3, and pg 8.22.0. Do not reuse the former server node_modules: they did not match its manifest.
3. Follow `database-bootstrap.md` for explicitly isolated database acceptance. Keep database binaries/data/socket files and other verification tools OUTSIDE the Next.js build tree; Tailwind/Turbopack scans source files.
4. Start the built app against disposable local data with a 300 MiB cgroup limit and no swap. Verify login, logout/account switching, authenticated data isolation, assets, and negative authorization checks. Never use production provider credentials or generate billable images for a smoke test.
5. Build a checksummed artifact containing release source, `.next` (without its regenerable cache), and Linux dependencies. Exclude `.git`, real `.env` files, caches, test databases, local backups, screenshots, uploads, and generated user images. `.env.example` is placeholders only.

## Publish

- Record the active `/opt/deeproast-current` target, Build ID, service state, and the artifact checksum. Keep the previous release untouched.
- Upload and extract into a NEW directory under `/opt/deeproast-releases/`. Verify the checksum, source manifest, architecture, runtime versions, and available disk/memory before switching.
- Keep the existing environment file `/opt/deeproast/.env.production`, persistent data root, reverse-proxy security rules, and 300 MiB service limit. This repair does NOT require production database migration or seed operations.
- Temporarily reject new application API writes at the reverse proxy with HTTP 503 and Retry-After. Preserve all other sites and security rules. Wait for unexpired `processing` request leases to drain; abort the release rather than kill active generation jobs.
- Switch the current symlink atomically and restart the ONE application service. Do not run a parallel Next.js instance on this host.
- Verify `/login` -> 200, unauthenticated `/api/config` and a syntactically valid private-image URL -> 401, direct legacy `/images/*` -> 404, and actual JS/CSS/font assets -> 200. Check process restarts, errors, and memory, then restore the exact original reverse-proxy config.
- The release runner must restore the proxy configuration on success, failure, or interruption, and roll back an unhealthy application release.

## Rollback

Use the recorded previous release, not a guessed directory. Validate that both old and new targets are real directories under `/opt/deeproast-releases/` and the previous build still exists. Atomically replace `/opt/deeproast-current` with a symlink to that recorded target, restart `deeproast.service`, and repeat health checks. Restore the original proxy configuration if a maintenance gate remains. Do not restore or rewrite the database: this release performs no schema migration.

## Repository and local work

The production snapshot and the local development branch had diverged from the remote default branch. Publish the verified release on `release/production-stability-20260913`; do not force-push or silently replace `master`. Preserve historical documentation and useful tests. Keep local uncommitted/untracked work in a named stash plus an external verified Git bundle before switching the local project to the release branch. Do not overwrite local environment files, user assets, or ignored working directories.

The artifact manifest records raw release-file checksums and Git-content checksums (text normalized per `.gitattributes`). This distinguishes line-ending-only differences from real source drift.