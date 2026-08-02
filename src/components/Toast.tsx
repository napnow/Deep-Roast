"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";

// ── Toast types ──
export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  exiting?: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastItem["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ── Provider ──
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastItem["type"] = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    // Start exit animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    // Actually remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 260);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast Container */}
      <div
        className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 z-[100] flex flex-col-reverse gap-2.5 pointer-events-none items-stretch sm:items-end"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItemView key={t.id} item={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Single toast ──
function ToastItemView({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), 3000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  const icon = item.type === "success" ? "✓" : item.type === "error" ? "✗" : "ℹ";

  const bgClass =
    item.type === "success"
      ? "bg-emerald-50 dark:bg-emerald-500/8 border-emerald-200 dark:border-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : item.type === "error"
        ? "bg-red-50 dark:bg-red-500/8 border-red-200 dark:border-red-500/15 text-red-600 dark:text-red-300"
        : "bg-amber-50 dark:bg-amber-500/8 border-amber-200 dark:border-amber-500/15 text-amber-700 dark:text-amber-300";

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm shadow-lg backdrop-blur-xl ${
        item.exiting ? "animate-toast-out" : "animate-toast-in"
      } ${bgClass}`}
    >
      <span className="text-xs font-bold shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-current/10">
        {icon}
      </span>
      <span className="text-[13px] font-medium">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="ml-1 shrink-0 w-5 h-5 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity text-current"
      >
        ✕
      </button>
    </div>
  );
}
