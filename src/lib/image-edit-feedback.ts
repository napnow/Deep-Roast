export interface ImageEditRefundState {
  refundPending?: boolean;
  lastError?: string | null;
}

/** Only explicit financial state produces a refund warning. */
export function getRefundPendingNotice(result: ImageEditRefundState): string | null {
  if (!result.refundPending) return null;
  return result.lastError || "部分积分退款尚未完成，请联系管理员处理";
}
