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

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  } as const;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-[24rem] max-w-[calc(100vw-2rem)] rounded-2xl border p-5 space-y-3"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            重置密码 · {user.username}
          </h2>
          <button type="button" onClick={onClose} style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          请妥善告知用户新密码；生成的临时密码仅显示一次。
        </p>

        {tempShown ? (
          <div className="space-y-2">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              临时密码（仅此一次）:
            </p>
            <code
              className="block w-full rounded-lg px-3 py-2 text-sm font-mono select-all"
              style={{ background: "var(--bg-root)", border: "1px solid var(--border)" }}
            >
              {tempShown}
            </code>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={copyTemp}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: "var(--accent-surface)",
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
                }}
              >
                复制
              </button>
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs">
                关闭
              </button>
            </div>
          </div>
        ) : (
          <>
            <form onSubmit={handSet} className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="新密码（≥8）"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="确认新密码"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={inputStyle}
              />
              <div className="flex flex-wrap gap-2 justify-between pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={generate}
                  className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                  style={{
                    background: "var(--bg-root)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  生成随机密码
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                  style={{
                    background: "var(--accent-surface)",
                    border: "1px solid var(--accent)",
                    color: "var(--accent)",
                  }}
                >
                  {saving ? "处理中…" : "确认手填重置"}
                </button>
              </div>
            </form>
          </>
        )}

        {error && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
