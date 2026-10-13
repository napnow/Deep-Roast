import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../globals.css", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("login hero CTA uses the approved outline treatment", () => {
  const block = css.match(/\.hero-cta \{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(block, /min-height:\s*44px/);
  assert.match(
    block,
    /background:\s*rgba\(212,\s*137,\s*74,\s*0\.0[46]\)/,
  );
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
