"use client";

import { useState, useEffect } from "react";
import type { CreditTransaction } from "@/types";
import {
  CREDIT_TYPE_LABELS,
  CREDIT_PER_IMAGE,
  CHECKIN_REWARD,
  RECHARGE_PLANS,
} from "@/types";

interface CreditWalletModalProps {
  open: boolean;
  onClose: () => void;
  credits: number;
  role: string;
  checkinEligible: boolean;
  todayChecked: boolean;
  checkinLoading?: boolean;
  onCheckinClick: () => void;
}

export default function CreditWalletModal({
  open,
  onClose,
  credits,
  role,
  checkinEligible,
  todayChecked,
  checkinLoading,
  onCheckinClick,
}: CreditWalletModalProps) {
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch("/api/credits/transactions")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setTransactions(data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open]);

  const totalCheckin = transactions
    .filter((tx) => tx.type === "checkin")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalConsumed = transactions
    .filter((tx) => tx.type === "consume")
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl border w-full max-w-md max-h-[80vh] flex flex-col animate-fade-up"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2
              className="text-base font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              我的钱包
            </h2>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              积分明细与消费记录
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all duration-150 hover:scale-110"
            style={{
              background: "var(--bg-root)",
              color: "var(--text-muted)",
            }}
          >
            ✕
          </button>
        </div>

        <div
          className="mx-5 mt-4 rounded-xl p-4 shrink-0"
          style={{
            background: "linear-gradient(135deg, #1677FF 0%, #0958d9 100%)",
            color: "#fff",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs opacity-80">当前余额</p>
              <p className="text-3xl font-bold mt-1">{credits}</p>
              <p className="text-xs mt-0.5 opacity-70">
                {role === "admin"
                  ? "管理员生图不扣积分"
                  : `可生成 ${Math.floor(credits / CREDIT_PER_IMAGE)} 张图片`}
              </p>
            </div>
            {checkinEligible && (
              <button
                onClick={onCheckinClick}
                disabled={todayChecked || checkinLoading}
                className="px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100 shrink-0"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.3)",
                }}
              >
                {checkinLoading
                  ? "签到中…"
                  : todayChecked
                    ? "今日已签"
                    : `签到 +${CHECKIN_REWARD}`}
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 mx-5 mt-3 shrink-0">
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: "var(--bg-root)" }}
          >
            <p className="text-lg font-bold" style={{ color: "#10b981" }}>
              +{totalCheckin}
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              累计签到积分
            </p>
          </div>
          <div
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: "var(--bg-root)" }}
          >
            <p
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              −{totalConsumed}
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              累计消耗积分
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          <h3
            className="text-[11px] font-semibold tracking-widest uppercase mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            积分流水
          </h3>

          {loading ? (
            <p
              className="text-xs text-center py-8"
              style={{ color: "var(--text-muted)" }}
            >
              加载中...
            </p>
          ) : transactions.length === 0 ? (
            <p
              className="text-xs text-center py-8"
              style={{ color: "var(--text-muted)" }}
            >
              暂无记录
            </p>
          ) : (
            <div className="space-y-1.5">
              {transactions.map((tx) => {
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
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: typeInfo.color + "20",
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
                          className="text-[10px] truncate"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {tx.note}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
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
      </div>
    </div>
  );
}
