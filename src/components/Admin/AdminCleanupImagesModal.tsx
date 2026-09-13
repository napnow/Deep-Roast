"use client";

import { useEffect, useState } from "react";
import type { ImageCleanupPreview, ImageCleanupResult } from "@/types";
import { apiJson } from "@/lib/client-api";
import { AppIcon } from "@/components/ui/icons";

interface AdminCleanupImagesModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted: (result: ImageCleanupResult) => void | Promise<void>;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function AdminCleanupImagesModal({
  open,
  onClose,
  onCompleted,
}: AdminCleanupImagesModalProps) {
  const [preview, setPreview] = useState<ImageCleanupPreview | null>(null);
  const [result, setResult] = useState<ImageCleanupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void apiJson<ImageCleanupPreview>("/api/admin/cleanup-images")
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "获取图片清理预览失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleExecute() {
    if (executing || !preview || preview.imageCount === 0) return;

    setExecuting(true);
    setError("");
    try {
      const cleanupResult = await apiJson<ImageCleanupResult>(
        "/api/admin/cleanup-images",
        { method: "POST" },
      );
      setResult(cleanupResult);
      try {
        await onCompleted(cleanupResult);
      } catch {
        setError("图片已清理，但用户列表刷新失败，请手动刷新");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "图片清理失败，请稍后重试");
    } finally {
      setExecuting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="关闭图片清理预览"
        onClick={() => {
          if (!executing) onClose();
        }}
      />
      <div
        className="relative z-10 w-[38rem] max-w-[calc(100vw-2rem)] rounded-[var(--radius-xl)] border shadow-2xl animate-fade-up"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cleanup-images-title"
        aria-busy={loading || executing}
      >
        <header
          className="flex items-start justify-between gap-3 border-b p-5"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <p className="admin-kicker">服务器空间维护</p>
            <h2 id="cleanup-images-title" className="admin-title mt-1 text-lg">
              清理所有用户图片
            </h2>
            <p
              className="mt-1.5 text-[11.5px] leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              只删除普通用户的原图、缩略图和图片记录，不删除用户账号、对话或积分；永久保号会员的图片也会清理。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={executing}
            className="admin-btn admin-btn--ghost shrink-0 !px-2 !py-1 text-xs"
            aria-label="关闭"
          >
            关闭
          </button>
        </header>

        <div className="p-5">
          {loading ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              正在统计图片占用空间…
            </p>
          ) : error && !preview ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : result ? (
            <div className="space-y-3" role="status" aria-live="polite">
              <div
                className="rounded-[var(--radius)] border p-4"
                style={{
                  background: "var(--accent-surface)",
                  borderColor: "color-mix(in srgb, var(--accent) 30%, var(--border))",
                }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                  图片清理完成
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  已删除 {result.deletedRecords} 条图片记录，清理 {result.deletedArtifacts} 个文件。
                </p>
                {result.fileCleanupFailures > 0 && (
                  <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                    有 {result.fileCleanupFailures} 个文件未能删除，数据库记录已清理。
                  </p>
                )}
              </div>
              {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
            </div>
          ) : preview?.imageCount === 0 ? (
            <div className="py-8 text-center">
              <AppIcon name="check" size={24} className="mx-auto" style={{ color: "var(--accent)" }} />
              <p className="mt-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                当前没有可清理的用户图片
              </p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <div
                className="rounded-[var(--radius)] border p-4"
                style={{
                  background: "var(--danger-surface, rgba(220,38,38,0.08))",
                  borderColor: "color-mix(in srgb, var(--danger) 35%, var(--border))",
                }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
                  即将清理全站用户图片
                </p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  此操作不可恢复；用户账号仍会保留，但图片历史记录将被删除。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["涉及用户", preview.userCount],
                  ["图片记录", preview.imageCount],
                  ["图片文件", preview.artifactCount],
                  ["预计释放", formatBytes(preview.estimatedBytes)],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-[var(--radius)] border px-3 py-3"
                    style={{ borderColor: "var(--border)", background: "var(--bg-root)" }}
                  >
                    <p className="admin-kicker">{label}</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums" style={{ color: "var(--text-primary)" }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
            </div>
          ) : null}
        </div>

        {!loading && !result && preview?.imageCount ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t p-4" style={{ borderColor: "var(--border)" }}>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose} disabled={executing}>
              取消
            </button>
            <button type="button" className="admin-btn admin-btn--danger" onClick={handleExecute} disabled={executing}>
              {executing ? "清理中…" : "确认清理全部用户图片"}
            </button>
          </footer>
        ) : null}

        {result && (
          <footer className="flex justify-end border-t p-4" style={{ borderColor: "var(--border)" }}>
            <button type="button" className="admin-btn admin-btn--accent" onClick={onClose}>
              完成
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
