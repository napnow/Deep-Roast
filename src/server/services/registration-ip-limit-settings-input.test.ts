import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "@/server/http";
import { parseRegistrationIpLimitSettingsPatch } from "./registration-ip-limit-settings-input";

test("accepts only boolean registration IP limit updates", () => {
  assert.deepEqual(
    parseRegistrationIpLimitSettingsPatch({
      registrationIpLimitEnabled: false,
    }),
    { registrationIpLimitEnabled: false },
  );
  assert.deepEqual(parseRegistrationIpLimitSettingsPatch({}), {});
  assert.throws(
    () =>
      parseRegistrationIpLimitSettingsPatch({
        registrationIpLimitEnabled: "false",
      }),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
});
