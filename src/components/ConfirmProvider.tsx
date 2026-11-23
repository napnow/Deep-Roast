"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（删除/重置）用红色确认按钮；默认 true */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async (o) =>
  typeof window !== "undefined"
    ? window.confirm(typeof o === "string" ? o : o.message)
    : false,
);

/** 替代原生 window.confirm：`if (!(await confirm("删除？"))) return;` */
export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const confirm = useCallback<ConfirmFn>((o) => {
    resolver.current?.(false);
    setOpts(typeof o === "string" ? { message: o } : o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);
  const danger = opts?.danger ?? true;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {opts && (
        <Dialog open onClose={() => settle(false)} label={opts.title || "确认操作"}>
          <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-fade-in"
              onClick={() => settle(false)}
              aria-hidden
            />
            <div className="ui-confirm-card relative w-full max-w-sm rounded-2xl p-6 animate-scale-in">
              <h3 className="font-display text-[length:var(--text-lg)] font-semibold mb-2 text-[var(--text-primary)]">
                {opts.title || "确认操作"}
              </h3>
              <p className="text-[length:var(--text-sm)] leading-relaxed mb-6 text-[var(--text-secondary)] whitespace-pre-line">
                {opts.message}
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => settle(false)}
                  className="ui-confirm-btn ui-confirm-btn--ghost"
                >
                  {opts.cancelText || "取消"}
                </Button>
                <Button
                  variant={danger ? "danger" : undefined}
                  autoFocus
                  onClick={() => settle(true)}
                  className={`ui-confirm-btn ${danger ? "ui-confirm-btn--danger" : "ui-confirm-btn--primary"}`}
                >
                  {opts.confirmText || (danger ? "确认删除" : "确认")}
                </Button>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}
