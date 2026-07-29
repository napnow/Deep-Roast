"use client";

import { useEffect, useRef, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";

const MIN = 8;

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  user: { id: string; username: string } | null;
}

export default function ResetPasswordModal({
  open,
  onClose,
  user,
}: ResetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [tempShown, setTempShown] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setPassword("");
      setConfirm("");
      setError("");
      setTempShown(null);
    }
    wasOpen.current = open;
  }, [open]);

  if (!open || !user) return null;

  async function handSet(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN) {
      setError(`密码至少需要 ${MIN} 个字符`);
      return;
    }
    if (password !== confirm) {
      setError("两次输入不一致");
      return;
    }
    setSaving(true);
    try {
      await apiJson(`/api/admin/users/${user!.id}/reset-password`, {
        method: "POST",
        ...jsonBody({ password }),
      });
      setTempShown(null);
      setError("");
      alert(`已重置用户 ${user!.username} 的密码（请自行告知用户）`);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "重置失败");
    }
    setSaving(false);
  }

  async function generate() {
    setError("");
    setSaving(true);
    try {
      const data = await apiJson<{
        success: boolean;
        temporaryPassword?: string;
      }>(`/api/admin/users/${user!.id}/reset-password`, {
        method: "POST",
        ...jsonBody({ generate: true }),
      });
      if (!data.temporaryPassword) {
        setError("未返回临时密码");
      } else {
        setTempShown(data.temporaryPassword);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败");
    }
    setSaving(false);
  }

  async function copyTemp() {
    if (!tempShown) return;
    try {
      await navigator.clipboard.writeText(tempShown);
      alert("已复制到剪贴板");
    } catch {
      alert("复制失败，请手动选中复制");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(18, 14, 10, 0.45)",
          backdropFilter: "blur(6px)",
        }}
        onClick={() => {
          if (!tempShown) onClose();
        }}
      />
      <div
        className="relative z-10 w-[24rem] max-w-[calc(100vw-2rem)] rounded-[var(--radius-xl)] border p-5 space-y-3.5 animate-fade-up"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="admin-kicker">Security</p>
            <h2 className="admin-title text-lg mt-1">
              重置密码 · {user.username}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="admin-btn admin-btn--ghost !px-2 !py-1 text-xs"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>

        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          请妥善告知用户新密码；生成的临时密码仅显示一次。
        </p>

        {tempShown ? (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              临时密码（仅此一次）
            </p>
            <code
              className="block w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-mono select-all"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border-strong)",
                color: "var(--text-primary)",
              }}
            >
              {tempShown}
            </code>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={copyTemp}
                className="admin-btn admin-btn--accent"
              >
                复制
              </button>
              <button
                type="button"
                onClick={onClose}
                className="admin-btn admin-btn--ghost"
              >
                关闭
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handSet} className="space-y-2.5">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="新密码（≥8）"
              className="admin-input"
              autoComplete="new-password"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="确认新密码"
              className="admin-input"
              autoComplete="new-password"
            />
            <div className="flex flex-wrap gap-2 justify-between pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={generate}
                className="admin-btn admin-btn--ghost"
              >
                生成随机密码
              </button>
              <button
                type="submit"
                disabled={saving}
                className="admin-btn admin-btn--solid"
              >
                {saving ? "处理中…" : "确认手填重置"}
              </button>
            </div>
          </form>
        )}

        {error && (
          <p className="text-xs font-medium" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
