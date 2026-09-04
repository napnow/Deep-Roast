import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("mobile announcement panel is anchored inside the viewport", async () => {
  const componentSource = await readFile(
    new URL("./AnnouncementBell.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(componentSource, /announcement-bell__panel/);
  assert.match(
    cssSource,
    /@media \(max-width: 640px\)[\s\S]*?\.announcement-bell__panel\s*\{[\s\S]*?position: fixed;[\s\S]*?left: 0\.75rem;[\s\S]*?right: 0\.75rem;/,
  );
});
