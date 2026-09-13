"use client";
import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  createContext,
  useContext,
} from "react";
import { createPortal } from "react-dom";
import { useDeepRoastStore } from "@/lib/store";
export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  epoch: number;
}
interface ToastContextValue {
  toast: (message: string, type?: ToastItem["type"]) => void;
}
const ToastContext = createContext<ToastContextValue>({ toast: () => {} });
export function useToast() {
  return useContext(ToastContext);
}
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [host, setHost] = useState<Element | null>(null);
  const epoch = useDeepRoastStore((s) => s.userSessionVersion);
  useEffect(() => {
    const sync = () => {
      const dialogs = document.querySelectorAll("dialog[open]");
      setHost(dialogs.item(dialogs.length - 1) || document.body);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, []);
  const addToast = useCallback(
    (message: string, type: ToastItem["type"] = "info") => {
      const currentEpoch = useDeepRoastStore.getState().userSessionVersion;
      setToasts((prev) => [
        ...prev
          .filter((t) => t.epoch === currentEpoch && t.message !== message)
          .slice(-3),
        {
          id: Math.random().toString(36).slice(2),
          message,
          type,
          epoch: currentEpoch,
        },
      ]);
    },
    [],
  );
  const dismiss = useCallback(
    (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );
  const value = useMemo(() => ({ toast: addToast }), [addToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {host &&
        createPortal(
          <div className="ui-toast-stack">
            {toasts
              .filter((t) => t.epoch === epoch)
              .map((item) => (
                <ToastItemView key={item.id} item={item} onDismiss={dismiss} />
              ))}
          </div>,
          host,
        )}
    </ToastContext.Provider>
  );
}
function ToastItemView({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false);
  useEffect(() => {
    if (item.type === "error" || hovered || focused) return;
    const timer = setTimeout(
      () => onDismiss(item.id),
      item.type === "success" ? 3200 : 5000,
    );
    return () => clearTimeout(timer);
  }, [item.id, item.type, hovered, focused, onDismiss]);
  return (
    <div
      className={`ui-toast ui-toast--${item.type}`}
      role={item.type === "error" ? "alert" : "status"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <span className="ui-toast-mark" aria-hidden="true">
        {item.type === "success" ? "✓" : item.type === "error" ? "!" : "i"}
      </span>
      <span>{item.message}</span>
      <button
        type="button"
        className="ui-toast-dismiss"
        aria-label="关闭通知"
        onClick={() => onDismiss(item.id)}
      >
        ×
      </button>
    </div>
  );
}
