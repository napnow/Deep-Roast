import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("login page does not request or render announcements", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /api\/public\/announcements/);
  assert.doesNotMatch(source, /announcements\.map|公告/);
});
