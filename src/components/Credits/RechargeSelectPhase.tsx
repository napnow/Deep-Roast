"use client";

import { RECHARGE_PLANS, CREDIT_PER_IMAGE } from "@/types";

interface RechargeSelectPhaseProps {
  credits: number;
  onClose: () => void;
  onSelectPlan: (plan: (typeof RECHARGE_PLANS)[0]) => void;
}

export default function RechargeSelectPhase({
  credits,
  onClose,
  onSelectPlan,
}: RechargeSelectPhaseProps) {
  return (
    <div
      className="rounded-2xl border w-full max-w-md animate-fade-up"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-xl)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <h2
            className="text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            充值积分
          </h2>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            当前积分:{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
              {credits}
            </span>{" "}
            · 可生成 {Math.floor(credits / CREDIT_PER_IMAGE)} 张图
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all duration-150 hover:scale-110"
          style={{ background: "var(--bg-root)", color: "var(--text-muted)" }}
        >
          ✕
        </button>
      </div>

      <div className="p-5 space-y-3">
        {RECHARGE_PLANS.map((plan) => (
          <button
            key={plan.planId}
            onClick={() => onSelectPlan(plan)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden"
            style={{
              background: plan.badge
                ? "var(--accent-surface)"
                : "var(--bg-root)",
              borderColor: plan.badge ? "var(--accent)" : "var(--border)",
            }}
          >
            {plan.badge && (
              <span
                className="absolute -top-0.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-b"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {plan.badge}
              </span>
            )}
            <div className="text-left">
              <span
                className="text-lg font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {plan.label}
              </span>
            </div>
            <div className="text-right">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-secondary)" }}
              >
                {plan.credits} 积分
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                ≈ {Math.floor(plan.credits / CREDIT_PER_IMAGE)} 张图
              </p>
            </div>
          </button>
        ))}
      </div>

      <div
        className="px-5 py-3 border-t text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          支付宝模拟支付 · 实际不产生费用
        </p>
      </div>
    </div>
  );
}
