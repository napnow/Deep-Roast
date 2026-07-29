"use client";

import { useState, useEffect, useRef } from "react";
import { RECHARGE_PLANS } from "@/types";
import type { CreditTransaction } from "@/types";
import RechargeSelectPhase from "@/components/Credits/RechargeSelectPhase";
import RechargePayingPhase from "@/components/Credits/RechargePayingPhase";
import RechargeSuccessPhase from "@/components/Credits/RechargeSuccessPhase";

interface CreditRechargeModalProps {
  open: boolean;
  onClose: () => void;
  credits: number;
  onCreditsChange: (newBalance: number) => void;
  onWalletClick: () => void;
}

type Phase = "select" | "paying" | "success";

export default function CreditRechargeModal({
  open,
  onClose,
  credits,
  onCreditsChange,
  onWalletClick,
}: CreditRechargeModalProps) {
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedPlan, setSelectedPlan] = useState<
    (typeof RECHARGE_PLANS)[0] | null
  >(null);
  const [countdown, setCountdown] = useState(3);
  const [orderId] = useState(
    () =>
      "DB" +
      Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).slice(2, 6).toUpperCase(),
  );
  const [txResult, setTxResult] = useState<CreditTransaction | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paymentStarted = useRef(false);

  useEffect(() => {
    if (open) {
      setPhase("select");
      setSelectedPlan(null);
      setCountdown(3);
      setError("");
      setTxResult(null);
      paymentStarted.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (phase === "paying" && countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (!paymentStarted.current) {
              paymentStarted.current = true;
              // fire after state update settles
              queueMicrotask(() => {
                void completePayment();
              });
            }
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  async function completePayment() {
    const plan = selectedPlan;
    if (!plan || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/credits/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.planId }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "充值失败");
        setPhase("select");
        setLoading(false);
        paymentStarted.current = false;
        return;
      }

      const data = await res.json();
      setTxResult(data.transaction);
      onCreditsChange(data.balance);
      setPhase("success");
    } catch {
      setError("网络错误");
      setPhase("select");
      paymentStarted.current = false;
    }
    setLoading(false);
  }

  function handleSelectPlan(plan: (typeof RECHARGE_PLANS)[0]) {
    setSelectedPlan(plan);
    setCountdown(3);
    paymentStarted.current = false;
    setPhase("paying");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      {phase === "select" && (
        <RechargeSelectPhase
          credits={credits}
          onClose={onClose}
          onSelectPlan={handleSelectPlan}
        />
      )}

      {phase === "paying" && selectedPlan && (
        <RechargePayingPhase
          selectedPlan={selectedPlan}
          orderId={orderId}
          countdown={countdown}
          loading={loading}
          onCancel={() => {
            paymentStarted.current = false;
            setPhase("select");
          }}
        />
      )}

      {phase === "success" && (
        <RechargeSuccessPhase
          orderId={orderId}
          selectedPlan={selectedPlan}
          txResult={txResult}
          onClose={onClose}
          onWalletClick={onWalletClick}
        />
      )}

      {error && (
        <div
          className="absolute bottom-8 rounded-xl p-3 text-xs animate-fade-in"
          style={{
            background: "var(--danger-surface)",
            color: "var(--danger)",
            border: "1px solid var(--danger)",
          }}
        >
          ✗ {error}
        </div>
      )}
    </div>
  );
}
