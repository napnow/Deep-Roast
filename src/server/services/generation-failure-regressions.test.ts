import { test } from "node:test";
import {
  testPartialBatch,
  testUpstreamRetry,
  testRefundSignal,
  testEditRetryIdentity,
  testAllFailedRefundReplay,
} from "../test-support/generation-regression-harness.cjs";

test("v1 partial success returns charged images and replays them", testPartialBatch);
test("uncertain image retries reuse one upstream business key", testUpstreamRetry);
test("image edit batches retain refund-pending state", testRefundSignal);

test("distinct image edits keep separate keys while each retry reuses its key", testEditRetryIdentity);
test("all-failed v1 batches preserve pending refunds in either error order and replay", testAllFailedRefundReplay);
