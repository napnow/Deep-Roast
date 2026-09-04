import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("home wires public donation availability to header and modal state", () => {
  const home = readFileSync("src/app/page.tsx", "utf8");
  const modals = readFileSync("src/components/AppModals.tsx", "utf8");

  assert.match(home, /api\/public\/donation/);
  assert.match(home, /donationEnabled/);
  assert.match(home, /setDonationOpen/);
  assert.match(modals, /DonationModal/);
  assert.match(modals, /donationOpen/);
});
