"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm rounded-2xl p-5 animate-scale-in"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <h3
          className="font-display text-base font-semibold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h3>
        <p
          className="text-sm leading-relaxed mb-5"
          style={{ color: "var(--text-secondary)" }}
        >
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{
              background: "var(--danger)",
              color: "#fff",
              border: "1px solid var(--danger)",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
