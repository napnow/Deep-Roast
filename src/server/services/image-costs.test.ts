import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildImageModelCreditCosts,
  calculateImageCreditCost,
  parseImageModelCreditCost,
} from "./image-costs";
import {
  buildAdminImageModelCreditCosts,
  normalizeImageModelCostMap,
} from "./image-costs-api";

test("accepts positive safe integer image costs", () => {
  assert.equal(parseImageModelCreditCost(1), 1);
  assert.equal(parseImageModelCreditCost("12"), 12);
  assert.equal(parseImageModelCreditCost(2_147_483_647), 2_147_483_647);
});

test("rejects invalid image costs", () => {
  for (const value of [
    0,
    -1,
    1.5,
    "",
    "  ",
    "free",
    2_147_483_648,
    Number.MAX_SAFE_INTEGER + 1,
    null,
  ]) {
    assert.throws(() => parseImageModelCreditCost(value), {
      code: "INVALID_IMAGE_CREDIT_COST",
      status: 400,
    });
  }
});

test("calculates batch image cost from per-image cost", () => {
  assert.equal(calculateImageCreditCost(7, 1), 7);
  assert.equal(calculateImageCreditCost(7, 4), 28);
  assert.equal(calculateImageCreditCost(7, 0), 7);
  assert.equal(calculateImageCreditCost(7, 99), 35);
});

test("fills missing or invalid stored costs with the default", () => {
  assert.deepEqual(
    buildImageModelCreditCosts(
      ["gpt-image-2", "seedream", "gpt-image-2"],
      [
        { modelId: "gpt-image-2", creditsPerImage: 9 },
        { modelId: "seedream", creditsPerImage: 0 },
      ],
    ),
    { "gpt-image-2": 9, seedream: 5 },
  );
});

test("normalizes and validates an admin cost mapping", () => {
  assert.deepEqual(
    normalizeImageModelCostMap({ " gpt-image-2 ": "9", seedream: 1 }),
    { "gpt-image-2": 9, seedream: 1 },
  );
  assert.deepEqual(normalizeImageModelCostMap({}), {});
  assert.throws(() => normalizeImageModelCostMap({ "": 5 }), {
    code: "INVALID_IMAGE_MODEL_COSTS",
    status: 400,
  });
  assert.throws(() => normalizeImageModelCostMap({ "gpt-image-2": 0 }), {
    code: "INVALID_IMAGE_CREDIT_COST",
    status: 400,
  });
  assert.throws(
    () => normalizeImageModelCostMap({ " model ": 5, model: 6 }),
    { code: "INVALID_IMAGE_MODEL_COSTS", status: 400 },
  );
});

test("admin listing preserves configured costs for disabled models", () => {
  assert.deepEqual(
    buildAdminImageModelCreditCosts(
      ["gpt-image-2"],
      [
        { modelId: "gpt-image-2", creditsPerImage: 9 },
        { modelId: "legacy-image-model", creditsPerImage: 12 },
      ],
    ),
    { "gpt-image-2": 9, "legacy-image-model": 12 },
  );
});
