/** Browser-only actions report completion truthfully; never silently save an API error as an image. */
export class BrowserActionError extends Error {}
export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText)
    throw new BrowserActionError("无法访问剪贴板，请选中文字后手动复制。");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new BrowserActionError(
      "复制未完成，请允许剪贴板权限，或选中文字后手动复制。",
    );
  }
}
export async function initiateImageDownload(
  url: string,
  filename: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new BrowserActionError(
      response.status === 401 || response.status === 403
        ? "下载未完成，请确认登录状态后重试。"
        : "图片暂时无法下载，请稍后重试。",
    );
  const blob = await response.blob();
  if (!blob.size || !blob.type.toLowerCase().startsWith("image/"))
    throw new BrowserActionError(
      "返回的内容不是有效图片，未保存文件，请稍后重试。",
    );
  signal?.throwIfAborted();
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/svg+xml": "svg",
  };
  const extension = extensions[blob.type.toLowerCase()] || "png";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = objectUrl;
    anchor.download = filename.replace(/\.[^.]+$/, "") + "." + extension;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  } finally {
    anchor.remove();
  }
  // The browser may consume the URL after click returns, especially on mobile Safari.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}
