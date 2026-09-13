"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDeepRoastStore } from "@/lib/store";
import { useToast } from "@/components/Toast";
import { BrowserActionError } from "@/lib/browser-actions";
type Status = "idle" | "pending" | "success" | "error";
export function useActionFeedback(scope = "") {
  const epoch = useDeepRoastStore((s) => s.userSessionVersion);
  const { toast } = useToast();
  const [feedback, setFeedback] = useState({
    epoch,
    scope,
    status: "idle" as Status,
  });
  const live = useRef(false),
    scopeRef = useRef(scope);
  const active = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    live.current = true;
    scopeRef.current = scope;
    return () => {
      live.current = false;
      active.current?.abort();
      active.current = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scope, epoch]);
  const run = useCallback(
    async (
      action: (signal: AbortSignal) => Promise<void>,
      successText: string,
      fallbackError = "操作未完成，请稍后重试。",
    ) => {
      if (active.current) return false;
      const controller = new AbortController();
      active.current = controller;
      if (timer.current) clearTimeout(timer.current);
      const current = () =>
        live.current &&
        !controller.signal.aborted &&
        scopeRef.current === scope &&
        useDeepRoastStore.getState().userSessionVersion === epoch;
      setFeedback({ epoch, scope, status: "pending" });
      try {
        await action(controller.signal);
        if (!current()) return false;
        setFeedback({ epoch, scope, status: "success" });
        if (successText) toast(successText, "success");
        timer.current = setTimeout(() => {
          if (current()) setFeedback({ epoch, scope, status: "idle" });
        }, 2200);
        return true;
      } catch (error) {
        if (current()) {
          setFeedback({ epoch, scope, status: "error" });
          toast(
            error instanceof BrowserActionError ? error.message : fallbackError,
            "error",
          );
        }
        return false;
      } finally {
        if (active.current === controller) active.current = null;
      }
    },
    [epoch, scope, toast],
  );
  return {
    status:
      feedback.epoch === epoch && feedback.scope === scope
        ? feedback.status
        : ("idle" as Status),
    run,
  };
}
