"use client";

import { useEffect, useState } from "react";
import type { CleanupPreview, CleanupResult, CleanupCandidate } from "@/types";
import { apiJson } from "@/lib/client-api";
import { AppIcon } from "@/components/ui/icons";

interface AdminCleanupUsersModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted: (result: CleanupResult) => void | Promise<void>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN");
}

function statusLabel(status: string) {
  return status === "banned" ? "已封禁" : "正常";
}

function CandidateRow({ candidate }: { candidate: CleanupCandidate }) {
  return (
    <li
      className="rounded-[var(--radius)] border px-3 py-2.5"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-root)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="min-w-0 truncate text-sm" style={{ color: "var(--text-primary)" }}>
          {candidate.username}
        </strong>
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
          style={
            candidate.status === "banned"
              ? { background: "var(--danger-surface)", color: "var(--danger)" }
              : { background: "var(--accent-surface)", color: "var(--accent)" }
          }
        >
          {statusLabel(candidate.status)}
        </span>
      </div>
      <div
        className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] tabular-nums"
        style={{ color: "var(--text-muted)" }}
      >
        <span>最后使用 {formatDate(candidate.lastActivityAt)}</span>
        <span>{candidate.conversationCount} 对话</span>
        <span>{candidate.imageCount} 图</span>
      </div>
    </li>
  );
}

export default function AdminCleanupUsersModal({
  open,
  onClose,
  onCompleted,
}: AdminCleanupUsersModalProps) {
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void apiJson<CleanupPreview>("/api/admin/cleanup-users")
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "获取清理预览失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, reloadToken]);

  async function handleExecute() {
    if (executing || !preview || preview.total === 0) return;

    setExecuting(true);
    setError("");
    try {
      const cleanupResult = await apiJson<CleanupResult>(
        "/api/admin/cleanup-users",
        { method: "POST" },
      );
      setResult(cleanupResult);
      try {
        await onCompleted(cleanupResult);
      } catch {
        setError("清理已完成，但用户列表刷新失败，请手动刷新。");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "清理失败，请稍后重试");
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
        aria-label="关闭清理预览"
        onClick={() => {
          if (!executing) onClose();
        }}
      />
      <div
        className="relative z-10 w-[38rem] max-w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col rounded-[var(--radius-xl)] border shadow-2xl animate-fade-up"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cleanup-users-title"
        aria-busy={loading || executing}
      >
        <header className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0">
            <p className="admin-kicker">用户维护</p>
            <h2 id="cleanup-users-title" className="admin-title mt-1 text-lg">
              批量清理未使用用户
            </h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              清理超过 3 天没有登录、对话或生图活动的普通用户。正常和已封禁账号都会纳入，管理员账号始终保留。
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

        <div className="min-h-0 overflow-y-auto p-5">
          {loading ? (
            <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              正在计算清理名单…
            </p>
          ) : result ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <div
                className="rounded-[var(--radius)] border p-4"
                style={{
                  background: "var(--accent-surface)",
                  borderColor: "color-mix(in srgb, var(--accent) 30%, var(--border))",
                }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                  清理完成
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  已删除 {result.deleted} 个用户。
                </p>
                {result.imageCleanupFailures > 0 && (
                  <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                    有 {result.imageCleanupFailures} 个图片文件未能删除，数据库记录已清理。
                  </p>
                )}
              </div>
              {result.users.length > 0 && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  已处理：{result.users.join("、")}
                </p>
              )}
            </div>
          ) : error && !preview ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => {
                  setError("");
                  setPreview(null);
                  setLoading(true);
                  setReloadToken((token) => token + 1);
                }}
              >
                关闭后重试
              </button>
            </div>
          ) : preview?.total === 0 ? (
            <div className="py-8 text-center">
              <AppIcon name="check" size={24} className="mx-auto" style={{ color: "var(--accent)" }} />
              <p className="mt-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                暂无符合条件的用户
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                截止 {formatDate(preview?.cutoff ?? "")}
              </p>
            </div>
          ) : preview ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  将删除 {preview.total} 个用户
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  活动截止：{formatDate(preview.cutoff)}
                </p>
              </div>
              <ul className="space-y-2" aria-label="待清理用户列表">
                {preview.candidates.map((candidate) => (
                  <CandidateRow key={candidate.id} candidate={candidate} />
                ))}
              </ul>
              {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
            </div>
          ) : null}
        </div>

        {!loading && !result && preview && preview.total > 0 && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t p-4" style={{ borderColor: "var(--border)" }}>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose} disabled={executing}>
              取消
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--danger"
              onClick={handleExecute}
              disabled={executing}
            >
              {executing ? "清理中…" : `确认删除 ${preview.total} 个用户`}
            </button>
          </footer>
        )}

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
