import assert from "node:assert/strict";
import { test } from "node:test";
import { getRefundPendingNotice } from "./image-edit-feedback";

test("refund pending is visible even when some image edits succeeded", () => {
  assert.equal(getRefundPendingNotice({ refundPending: true, lastError: "Refund pending" }), "Refund pending");
});
test("refund pending receives a safe fallback and ordinary failures are not financial alerts", () => {
  assert.match(getRefundPendingNotice({ refundPending: true }) || "", /\u9000\u6b3e/);
  assert.equal(getRefundPendingNotice({ lastError: "ordinary failure" }), null);
});
