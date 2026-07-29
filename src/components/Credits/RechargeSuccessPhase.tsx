"use client";

import { RECHARGE_PLANS } from "@/types";
import type { CreditTransaction } from "@/types";

interface RechargeSuccessPhaseProps {
  orderId: string;
  selectedPlan: (typeof RECHARGE_PLANS)[0] | null;
  txResult: CreditTransaction | null;
  onClose: () => void;
  onWalletClick: () => void;
}

export default function RechargeSuccessPhase({
  orderId,
  selectedPlan,
  txResult,
  onClose,
  onWalletClick,
}: RechargeSuccessPhaseProps) {
  return (
    <div
      className="rounded-2xl border w-full max-w-sm animate-fade-up"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-xl)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-6 text-center space-y-4">
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center animate-fade-up"
          style={{ background: "#10b981" }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            充值成功
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            订单号: {orderId}
          </p>
        </div>

        {selectedPlan && txResult && (
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: "var(--accent-surface)" }}
          >
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-muted)" }}>充值金额</span>
              <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                ¥{selectedPlan.amount}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-muted)" }}>获得积分</span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                +{selectedPlan.credits}
              </span>
            </div>
            <div
              className="flex justify-between text-sm pt-2 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              <span style={{ color: "var(--text-muted)" }}>当前余额</span>
              <span
                style={{ color: "var(--accent)", fontWeight: 700, fontSize: 16 }}
              >
                {txResult.balanceAfter} 积分
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              onClose();
              onWalletClick();
            }}
            className="flex-1 py-2.5 rounded-lg text-xs font-medium transition-all duration-150"
            style={{
              background: "var(--bg-root)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            📋 查看流水
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: "var(--accent)",
              color: "#fff",
            }}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
