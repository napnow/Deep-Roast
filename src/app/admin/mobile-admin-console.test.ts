import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("admin page exposes a mobile user selector without replacing desktop data flow", () => {
  const page = readFileSync("src/app/admin/page.tsx", "utf8");
  const rail = readFileSync("src/components/Admin/AdminUserList.tsx", "utf8");
  const sheetPath = "src/components/Admin/MobileAdminUserSheet.tsx";

  assert.equal(existsSync(sheetPath), true, "mobile user sheet must exist");
  const sheet = readFileSync(sheetPath, "utf8");

  assert.match(page, /MobileAdminUserSheet/);
  assert.match(page, /mobileUserSheetOpen/);
  assert.match(rail, /onOpenMobileUsers/);
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /users\.map/);
});

test("mobile admin layout is isolated from the desktop rail", () => {
  const css = readFileSync("src/app/globals.css", "utf8");

  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*\.admin-shell[\s\S]*flex-direction: column/,
  );
  assert.match(
    css,
    /@media \(max-width: 767px\)[\s\S]*\.admin-rail[\s\S]*width: 100%/,
  );
  assert.match(css, /\.mobile-admin-user-sheet/);
  assert.match(css, /\.mobile-admin-user-sheet[\s\S]*overscroll-behavior: contain/);
  assert.match(css, /\.admin-rail \.admin-module-nav[\s\S]*display: flex/);
  assert.match(css, /\.admin-api-key-create[\s\S]*flex-direction: column/);
  assert.match(css, /\.admin-module-nav\s*\{\s*display: grid;/);
});
