import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
  packages: Record<string, { version?: string }>;
};
function atLeast(actual: string, minimum: string): boolean {
  const parts = actual.split(".").map(Number);
  const floor = minimum.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (parts[index] !== floor[index]) return parts[index] > floor[index];
  }
  return true;
}
for (const [name, minimum] of [
  ["next", "16.3.3"],
  ["sharp", "0.35.4"],
  ["baseline-browser-mapping", "2.11.0"],
]) {
  test(`${name} stays on a patched dependency version`, () => {
    const installed = Object.entries(lock.packages)
      .filter(([path]) => path.endsWith(`node_modules/${name}`))
      .map(([, value]) => value.version || "0.0.0");
    assert.ok(installed.length > 0);
    for (const version of installed) {
      assert.ok(
        atLeast(version, minimum),
        `${name} ${version} must be >= ${minimum}`,
      );
    }
  });
}
