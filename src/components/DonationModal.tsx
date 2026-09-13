"use client";

import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";

import { useEffect, useState, useRef } from "react";

const DEFAULT_TEXT = "如果觉得好用，欢迎打赏支持一下 ☕";

interface DonationModalProps {
  open: boolean;
  onClose: () => void;
}

export default function DonationModal({ open, onClose }: DonationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/public/donation", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("获取失败");
        return res.json();
      })
      .then(
        (data: {
          enabled?: boolean;
          text?: string;
          imageUrl?: string | null;
        }) => {
          if (!active) return;
          if (data.enabled === false) {
            closeRef.current();
            return;
          }
          setText(data.text || "");
          setImageUrl(data.imageUrl || null);
        },
      )
      .catch(() => {
        if (active) setError("获取失败，请稍后重试");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [open]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} label="打赏支持">
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative z-10 h-full overflow-y-auto">
          <div
            className="flex min-h-full items-center justify-center p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
          >
            <div
              className="w-[22rem] max-w-full rounded-2xl border p-5 space-y-3"
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
                  💝 打赏支持
                </h2>
                <Button
                  size="icon"
                  onClick={onClose}
                  aria-label="关闭"
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110"
                  style={{ color: "var(--text-muted)" }}
                >
                  ✕
                </Button>
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
              {!loading && !error && !imageUrl && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  管理员暂未配置收款码，感谢你的心意 💛
                </p>
              )}
              {!loading && !error && (
                <p
                  className="text-sm whitespace-pre-wrap break-words"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {text.trim() || DEFAULT_TEXT}
                </p>
              )}
              {!loading && !error && imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="收款码"
                  className="mx-auto max-w-[16rem] w-full rounded-lg border"
                  style={{ borderColor: "var(--border)" }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
