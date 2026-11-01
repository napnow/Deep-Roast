import { ApiError } from "@/server/http";

export function imagePolicyError(payload: unknown, mode: "generate" | "edit"): ApiError | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  const error = payload.error;
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "content_policy_violation") return null;
  const detail = "message" in error && typeof error.message === "string" ? error.message : "";
  const input = mode === "edit" ? "提示词或参考图" : "提示词";
  let reason = "可能涉及上游内容限制";
  if (/\b(nudit(?:y|ies)|nude|naked|porn(?:ography|ographic)?|sexual(?:ly)?)\b|裸体|裸露|色情|性行为/i.test(detail)) {
    reason = "可能涉及裸露或色情内容";
  } else if (/\b(violence|violent|gore)\b|暴力|血腥/i.test(detail)) {
    reason = "可能涉及暴力或血腥内容";
  }
  return new ApiError(`图片未通过上游内容审核，${reason}。请检查并调整${input}后重试。`, 400, "IMAGE_CONTENT_POLICY");
}
