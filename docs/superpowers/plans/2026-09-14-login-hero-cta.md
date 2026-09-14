# Login Hero CTA Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the login hero's heavy solid CTA with the approved 44px warm-white outline treatment without changing navigation or animation behavior.

**Architecture:** Keep the existing `Magnetic` wrapper and anchor markup. Express the visual change in the existing `.hero-cta` CSS contract, add an explicit keyboard focus state, and protect the approved structure with a source contract test.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Node test runner, Playwright regression scripts.

## Global Constraints

- No new dependency or image asset.
- Do not change hero title, slogan, background, form, animation timing, or CTA navigation behavior.
- Touch target height must remain at least 44px.
- Preserve reduced-motion behavior and hide the decorative arrow from assistive technology.

---

### Task 1: Lock and implement the outline CTA contract

**Files:**
- Create: `src/app/login/login-hero-cta.test.ts`
- Modify: `src/app/globals.css:1258-1302`
- Verify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `.hero-cta` and `.hero-cta-arrow` class names already emitted by `LoginPage`.
- Produces: the approved default, hover, active, and `:focus-visible` visual states.

- [ ] **Step 1: Write the failing source contract test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../globals.css", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("login hero CTA uses the approved outline treatment", () => {
  const block = css.match(/\.hero-cta \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(block, /min-height:\s*44px/);
  assert.match(block, /background:\s*rgba\(212,\s*137,\s*74,\s*0\.0[46]\)/);
  assert.match(block, /border:\s*1px solid rgba\(245,\s*230,\s*211,/);
  assert.doesNotMatch(block, /linear-gradient/);
  assert.match(css, /\.hero-cta:focus-visible/);
});

test("CTA keeps navigation and a decorative unboxed arrow", () => {
  assert.match(page, /href="#start"/);
  assert.match(page, /className="hero-cta-arrow" aria-hidden/);
  const arrow = css.match(/\.hero-cta-arrow \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.doesNotMatch(arrow, /border-radius|background:/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --import tsx --test src/app/login/login-hero-cta.test.ts`

Expected: FAIL because the current CTA is 52px, gradient-filled, and the arrow has a circular background.

- [ ] **Step 3: Implement the minimal CSS change**

Replace the CTA rules with:

```css
.hero-cta {
  min-height: 44px;
  padding: 0 20px;
  display: inline-flex;
  align-items: center;
  gap: 16px;
  border: 1px solid rgba(245, 230, 211, 0.72);
  border-radius: 999px;
  white-space: nowrap;
  font-size: 0.925rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: rgba(212, 137, 74, 0.04);
  color: #f5e6d3;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 28px rgba(0, 0, 0, 0.12);
  transition: background 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.hero-cta:hover {
  background: rgba(212, 137, 74, 0.1);
  border-color: rgba(232, 165, 106, 0.92);
  color: #fff2e2;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 10px 32px rgba(0, 0, 0, 0.16);
}

.hero-cta:focus-visible {
  outline: 2px solid rgba(232, 165, 106, 0.9);
  outline-offset: 4px;
}

.hero-cta:active { transform: scale(0.98); }

.hero-cta-arrow {
  display: grid;
  place-items: center;
  color: #e8d7c3;
  transition: transform 220ms ease, color 180ms ease;
}

.hero-cta:hover .hero-cta-arrow {
  color: #e8a56a;
  transform: translateX(3px);
}
```

- [ ] **Step 4: Run focused and static checks**

Run: `node --import tsx --test src/app/login/login-hero-cta.test.ts`

Expected: 2 tests pass.

Run: `npm run typecheck && npx eslint src/app/login/page.tsx src/app/login/login-hero-cta.test.ts`

Expected: both commands exit 0.

- [ ] **Step 5: Run browser validation**

Run: `npm run build`, start the production server on an unused local port, and capture desktop plus mobile `/login` screenshots after the intro.

Expected: outline CTA matches the approved A preview, has one unboxed arrow, remains at least 44px tall, and clicking it reveals the login form.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/login/login-hero-cta.test.ts
git commit -m "style: refine login hero CTA"
```
