export function isLocalMobilePreview(
  search: string,
  environment: string | undefined,
): boolean {
  return (
    environment === "development" &&
    new URLSearchParams(search).get("preview") === "mobile"
  );
}
