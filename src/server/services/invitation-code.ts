import { randomBytes } from "node:crypto";

export const INVITE_CODE_LENGTH = 8;

export function createInviteCode(): string {
  return randomBytes(6).toString("base64url").slice(0, INVITE_CODE_LENGTH);
}
