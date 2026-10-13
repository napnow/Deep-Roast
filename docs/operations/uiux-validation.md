# Responsive UI regression validation

Use `npm ci`, then `npm run test:uiux`. This bundles the actual frontend components with esbuild and the actual Tailwind stylesheet, renders React in Chromium, and uses only synthetic in-memory data. It never starts the application server or connects to a database/provider. Unexpected requests are blocked and fail the test.

Install the test browser with `npx playwright install chromium`, or set `BROWSER_EXECUTABLE` to the absolute path of an installed Chrome/Chromium executable. `UIUX_TEST_OUTPUT` optionally chooses the report directory; the default `.uiux-test-results/` is ignored by Git.

Covered: desktop continuation stays on desktop, late reverse results after account remount are discarded, focused edit unmount releases scroll locks, closed-details keyboard traversal, nested confirmation, password labels/focus return, seven screen widths, and prompt/count/style shared between responsive surfaces.

The full route-integrated acceptance additionally uses only synthetic intercepted image/config/identity responses. Physical iOS/Android soft-keyboard and real paid generations are intentionally outside automated viewport coverage.

## Clean-install and advisory checks

A clean Linux `npm ci` is a release gate, not an existing `node_modules` test. Reconcile and commit the lockfile when introducing native/WASM optional dependencies; the UI update includes both root @emnapi 1.11.3 and Tailwind WASM's nested 1.11.1 dependency records. Never substitute `npm install` for the final clean-install gate.

Run `npm audit --omit=dev --registry=https://registry.npmjs.org` for production advisory verification. Some configured mirrors do not implement the npm advisory endpoint; an HTTP 404 from that endpoint is a failed audit, not evidence of zero vulnerabilities. Advisory results are time-bounded and do not replace application review.
