import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeInvitationListQuery } from "./invitations";

test("normalizes bounded admin invitation pagination", () => {
  assert.deepEqual(
    normalizeInvitationListQuery("300", "100"),
    { limit: 100, offset: 100 },
  );
  assert.deepEqual(
    normalizeInvitationListQuery("not-a-number", "-10"),
    { limit: 100, offset: 0 },
  );
});
