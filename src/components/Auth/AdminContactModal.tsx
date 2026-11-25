"use client";

import { useEffect, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import { AppIcon } from "@/components/ui/icons";

interface AdminContactModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminContactModal({
  open,
  onClose,
}: AdminContactModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/public/admin-contact", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("获取失败");
        return res.json();
      })
      .then((data: { text?: string; imageUrl?: string | null }) => {
        setText(data.text || "");
        setImageUrl(data.imageUrl || null);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("获取失败，请稍后重试");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open]);

  if (!open) return null;

  const empty = !loading && !error && !text.trim() && !imageUrl;

  return (
    <Dialog open={open} onClose={onClose} label="联系管理员">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(12, 10, 8, 0.62)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      >
        <div
          className="relative z-10 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border p-5 space-y-3 animate-scale-in"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              联系管理员
            </h2>
            <Button
              size="icon"
              onClick={onClose}
              aria-label="关闭联系管理员弹窗"
              className="flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
              }}
            >
              <AppIcon name="close" size={14} />
            </Button>
          </div>
          {loading && (
            <p className="text-xs py-2 text-[var(--text-muted)]">
              加载中…
            </p>
          )}
          {error && (
            <p className="text-xs py-2 text-[var(--danger)]">
              {error}
            </p>
          )}
          {empty && (
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              管理员暂未填写联系方式，请稍后再试或通过其他渠道联系。
            </p>
          )}
          {!loading && !error && text.trim() && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed text-[var(--text-secondary)]">
              {text}
            </p>
          )}
          {!loading && !error && imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="联系方式二维码"
              className="mx-auto max-w-[14rem] w-full rounded-xl border"
              style={{ borderColor: "var(--border)" }}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
}
