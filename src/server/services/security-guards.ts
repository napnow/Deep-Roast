import { ApiError } from "@/server/http";

export function assertCanonicalPublicOrigin(value: string | undefined): string {
  try {
    const url = new URL(value || "");
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      throw new Error("invalid public origin");
    }
    return url.origin;
  } catch {
    throw new ApiError("PUBLIC_APP_URL 必须是 HTTPS 根域名", 500);
  }
}
