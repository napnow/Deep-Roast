"use client";

import type { CreditTransaction } from "@/types";
import { CREDIT_TYPE_LABELS, RECHARGE_PLANS } from "@/types";

interface AdminCreditsTabProps {
  creditTx: CreditTransaction[];
  adjustAmount: number;
  adjustNote: string;
  adjustLoading: boolean;
  onAmountChange: (v: number) => void;
  onNoteChange: (v: string) => void;
  onAdjust: () => void;
}

export default function AdminCreditsTab({
  creditTx,
  adjustAmount,
  adjustNote,
  adjustLoading,
  onAmountChange,
  onNoteChange,
  onAdjust,
}: AdminCreditsTabProps) {
  return (
    <section className="space-y-4">
      <div
        className="rounded-xl border p-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
        }}
      >
        <h3
          className="text-xs font-semibold mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          ✏️ 手动调配积分
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={adjustAmount || ""}
            onChange={(e) => onAmountChange(parseInt(e.target.value) || 0)}
            placeholder="正数加/负数扣"
            className="flex-1 rounded-lg px-3 py-2 text-xs border"
            style={{
              background: "var(--bg-root)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <input
            type="text"
            value={adjustNote}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="备注"
            className="flex-1 rounded-lg px-3 py-2 text-xs border"
            style={{
              background: "var(--bg-root)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <button
            onClick={onAdjust}
            disabled={!adjustAmount || adjustLoading}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-95 disabled:opacity-40"
            style={{
              background: "var(--accent-surface)",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
            }}
          >
            {adjustLoading ? "处理中..." : "确认"}
          </button>
        </div>
      </div>

      <div>
        <h3
          className="text-xs font-semibold mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          📋 积分流水 ({creditTx.length})
        </h3>
        {creditTx.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            暂无记录
          </p>
        ) : (
          <div className="space-y-1.5">
            {creditTx.map((tx) => {
              const typeInfo = CREDIT_TYPE_LABELS[tx.type] || {
                label: tx.type,
                color: "#6b7280",
              };
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                  style={{ background: "var(--bg-root)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{
                        background: typeInfo.color + "20",
                        color: typeInfo.color,
                      }}
                    >
                      {typeInfo.label}
                    </span>
                    {tx.planId && (
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {RECHARGE_PLANS.find((p) => p.planId === tx.planId)
                          ?.label || tx.planId}
                      </span>
                    )}
                    {tx.note && (
                      <span
                        className="text-[10px] truncate max-w-[200px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {tx.note}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span
                      style={{
                        color: tx.amount >= 0 ? "#10b981" : "#ef4444",
                        fontWeight: 600,
                      }}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </span>
                    <span
                      style={{ color: "var(--text-muted)", minWidth: 40 }}
                    >
                      余额: {tx.balanceAfter}
                    </span>
                    <span
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {tx.createdAt
                        ? new Date(tx.createdAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
