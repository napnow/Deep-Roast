"use client";

import { useEffect, useState } from "react";

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
    setLoading(true);
    setError("");
    fetch("/api/public/admin-contact")
      .then(async (res) => {
        if (!res.ok) throw new Error("获取失败");
        return res.json();
      })
      .then((data: { text?: string; imageUrl?: string | null }) => {
        setText(data.text || "");
        setImageUrl(data.imageUrl || null);
      })
      .catch(() => setError("获取失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const empty = !loading && !error && !text.trim() && !imageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border p-5 space-y-3"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            联系管理员
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>
        {loading && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            加载中…
          </p>
        )}
        {error && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
        {empty && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            管理员暂未填写联系方式，请稍后再试或通过其他渠道联系。
          </p>
        )}
        {!loading && !error && text.trim() && (
          <p
            className="text-sm whitespace-pre-wrap break-words"
            style={{ color: "var(--text-secondary)" }}
          >
            {text}
          </p>
        )}
        {!loading && !error && imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="交流群"
            className="mx-auto max-w-[14rem] w-full rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          />
        )}
      </div>
    </div>
  );
}
