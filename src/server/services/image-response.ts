import { ApiError } from "@/server/http";

export function imageResponse(bytes: Uint8Array, key: string, thumbnail: boolean, download: boolean, check = false): Response {
  const type = thumbnail ? "image/webp" : /\.jpe?g$/i.test(key) ? "image/jpeg" : /\.webp$/i.test(key) ? "image/webp" : "image/png";
  if (download && !thumbnail) {
    const valid = type === "image/png" ? bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)
      : type === "image/jpeg" ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
    if (!valid) throw new ApiError("图片内容无效", 422, "INVALID_IMAGE");
  }
  const headers: Record<string, string> = { "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (check && download && !thumbnail) return new Response(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  return new Response(new Uint8Array(bytes), { status: 200, headers });
}
