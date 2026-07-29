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
      <div className="admin-card">
        <div className="admin-card-head">
          <div>
            <p className="admin-kicker">Ledger</p>
            <h3 className="admin-title text-base mt-1">手动调配积分</h3>
            <p
              className="text-[11px] mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              正数增加 · 负数扣除 · 写入流水
            </p>
          </div>
        </div>
        <div className="admin-card-body">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="number"
              value={adjustAmount || ""}
              onChange={(e) => onAmountChange(parseInt(e.target.value) || 0)}
              placeholder="正数加 / 负数扣"
              className="admin-input sm:flex-1"
            />
            <input
              type="text"
              value={adjustNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="备注（可选）"
              className="admin-input sm:flex-1"
            />
            <button
              type="button"
              onClick={onAdjust}
              disabled={!adjustAmount || adjustLoading}
              className="admin-btn admin-btn--solid shrink-0 sm:px-5"
            >
              {adjustLoading ? "处理中…" : "确认调配"}
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="admin-kicker">History</p>
            <h3 className="admin-title text-base mt-1">积分流水</h3>
          </div>
          <span
            className="text-[11px] tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {creditTx.length}
          </span>
        </div>

        {creditTx.length === 0 ? (
          <div
            className="rounded-[var(--radius-lg)] px-4 py-10 text-center text-xs"
            style={{
              background: "var(--bg-surface)",
              border: "1px dashed var(--border-strong)",
              color: "var(--text-muted)",
            }}
          >
            暂无记录
          </div>
        ) : (
          <div
            className="admin-card overflow-hidden divide-y"
            style={{ borderColor: "var(--border)" }}
          >
            {creditTx.map((tx) => {
              const typeInfo = CREDIT_TYPE_LABELS[tx.type] || {
                label: tx.type,
                color: "#6b7280",
              };
              const positive = tx.amount >= 0;
              return (
                <div
                  key={tx.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 tracking-wide"
                      style={{
                        background: typeInfo.color + "22",
                        color: typeInfo.color,
                      }}
                    >
                      {typeInfo.label}
                    </span>
                    {tx.planId && (
                      <span
                        className="text-[10px] shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {RECHARGE_PLANS.find((p) => p.planId === tx.planId)
                          ?.label || tx.planId}
                      </span>
                    )}
                    {tx.note && (
                      <span
                        className="text-[10.5px] truncate max-w-[220px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {tx.note}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 tabular-nums shrink-0">
                    <span
                      className="font-bold min-w-[3.25rem] text-right"
                      style={{
                        color: positive ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {positive && tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </span>
                    <span
                      className="text-[10.5px] min-w-[4.5rem] text-right"
                      style={{ color: "var(--text-muted)" }}
                    >
                      余 {tx.balanceAfter}
                    </span>
                    <span
                      className="text-[10px] min-w-[4.5rem] text-right"
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
