import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("header exposes the donation button between announcements and wallet", () => {
  const source = readFileSync("src/components/Header.tsx", "utf8");

  assert.match(source, /donationEnabled/);
  assert.match(source, /onDonationClick/);
  assert.match(source, /💝/);
  assert.match(source, /打赏支持/);
  assert.ok(
    source.indexOf("<AnnouncementBell />") < source.indexOf("💝"),
  );
  assert.ok(source.indexOf("💝") < source.indexOf("onClick={onWalletClick}"));
});
