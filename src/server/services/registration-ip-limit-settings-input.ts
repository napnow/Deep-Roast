import { ApiError } from "@/server/http";

export type RegistrationIpLimitSettingsPatch = {
  registrationIpLimitEnabled?: boolean;
};

export function parseRegistrationIpLimitSettingsPatch(body: {
  registrationIpLimitEnabled?: unknown;
}): RegistrationIpLimitSettingsPatch {
  const value = body.registrationIpLimitEnabled;
  if (value === undefined) return {};
  if (typeof value !== "boolean") {
    throw new ApiError("registrationIpLimitEnabled must be a boolean", 400);
  }
  return { registrationIpLimitEnabled: value };
}
