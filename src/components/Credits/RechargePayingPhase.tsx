"use client";

import { CREDIT_PER_IMAGE, RECHARGE_PLANS } from "@/types";

interface RechargePayingPhaseProps {
  selectedPlan: (typeof RECHARGE_PLANS)[0];
  orderId: string;
  countdown: number;
  loading: boolean;
  onCancel: () => void;
}

export default function RechargePayingPhase({
  selectedPlan,
  orderId,
  countdown,
  loading,
  onCancel,
}: RechargePayingPhaseProps) {
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
      <div
        className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "#1677FF" }}
      >
        <span className="text-white text-sm font-bold">支付宝</span>
        <span className="text-white text-xs opacity-80">模拟支付</span>
      </div>

      <div className="p-5 space-y-4 text-center">
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            支付金额
          </p>
          <p
            className="text-3xl font-bold mt-1"
            style={{ color: "var(--text-primary)" }}
          >
            ¥{selectedPlan.amount}
          </p>
        </div>

        <div
          className="rounded-xl p-3 space-y-1.5 text-left text-xs"
          style={{ background: "var(--bg-root)" }}
        >
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>商户名称</span>
            <span style={{ color: "var(--text-primary)" }}>深焙AI</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>订单号</span>
            <span
              style={{
                color: "var(--text-primary)",
                fontSize: 10,
                fontFamily: "monospace",
              }}
            >
              {orderId}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>商品</span>
            <span style={{ color: "var(--text-primary)" }}>
              {selectedPlan.credits} 积分 (
              {Math.floor(selectedPlan.credits / CREDIT_PER_IMAGE)} 张图)
            </span>
          </div>
        </div>

        <div
          className="w-36 h-36 mx-auto rounded-xl border flex items-center justify-center"
          style={{ background: "#fff", borderColor: "var(--border)" }}
        >
          <svg width="100" height="100" viewBox="0 0 100 100">
            <rect x="10" y="10" width="80" height="80" rx="4" fill="#000" />
            <rect x="15" y="15" width="70" height="70" rx="2" fill="#fff" />
            <rect x="20" y="20" width="24" height="24" rx="2" fill="#000" />
            <rect x="24" y="24" width="16" height="16" rx="1" fill="#fff" />
            <rect x="28" y="28" width="8" height="8" rx="1" fill="#000" />
            <rect x="56" y="20" width="24" height="24" rx="2" fill="#000" />
            <rect x="60" y="24" width="16" height="16" rx="1" fill="#fff" />
            <rect x="64" y="28" width="8" height="8" rx="1" fill="#000" />
            <rect x="20" y="56" width="24" height="24" rx="2" fill="#000" />
            <rect x="24" y="60" width="16" height="16" rx="1" fill="#fff" />
            <rect x="28" y="64" width="8" height="8" rx="1" fill="#000" />
            {[
              [50, 24],
              [60, 40],
              [42, 38],
              [70, 50],
              [38, 54],
              [52, 48],
              [34, 36],
              [58, 56],
              [44, 64],
              [68, 66],
              [48, 72],
              [30, 44],
              [62, 34],
              [54, 60],
              [36, 68],
              [66, 44],
              [40, 50],
              [56, 36],
            ].map(([x, y]) => (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width="3"
                height="3"
                fill="#000"
                rx="0.5"
              />
            ))}
          </svg>
        </div>

        <div>
          {countdown > 0 ? (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="flex gap-1">
                  {[0, 120, 240].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full animate-pulse-soft"
                      style={{
                        background: "var(--accent)",
                        animationDelay: `${delay}ms`,
                      }}
                    />
                  ))}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  支付中… {countdown}s
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--bg-root)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    background: "var(--accent)",
                    width: `${((3 - countdown) / 3) * 100}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--accent)" }}>
              正在处理…
            </p>
          )}
        </div>

        <button
          onClick={onCancel}
          disabled={loading}
          className="text-xs py-2 px-4 rounded-lg transition-all duration-150 hover:scale-105 disabled:opacity-50"
          style={{
            color: "var(--text-muted)",
            background: "var(--bg-root)",
            border: "1px solid var(--border)",
          }}
        >
          取消支付
        </button>
      </div>
    </div>
  );
}
