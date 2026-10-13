"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";
import { useToast } from "@/components/Toast";
import Dialog from "@/components/ui/Dialog";

// Local const — avoid pulling @/server/services/auth-password into the client bundle.
// Server source of truth remains MIN_PASSWORD_LENGTH in auth-password.ts.
const MIN_PASSWORD_LENGTH = 8;

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({
  open,
  onClose,
}: ChangePasswordModalProps) {
  const { toast } = useToast();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const wasOpen = useRef(false);
  const fieldId = useId();

  useEffect(() => {
    if (open && !wasOpen.current) {
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
      setError("");
    }
    wasOpen.current = open;
  }, [open]);

  if (!open) return null;

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  } as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!oldPassword || !newPassword) {
      setError("请填写旧密码和新密码");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符`);
      return;
    }
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPassword === oldPassword) {
      setError("新密码不能与旧密码相同");
      return;
    }

    setSaving(true);
    try {
      await apiJson("/api/auth/change-password", {
        method: "POST",
        ...jsonBody({ oldPassword, newPassword }),
      });
      toast("密码已修改", "success");
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "修改失败");
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onClose={onClose} label="修改密码">
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="relative z-10 h-full overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="w-[22rem] max-w-full rounded-2xl border shadow-2xl p-5"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  修改密码
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-11 h-11 rounded-full"
                  aria-label="关闭修改密码"
                  style={{ color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {(
                  [
                    ["旧密码", oldPassword, setOldPassword, "current-password"],
                    ["新密码", newPassword, setNewPassword, "new-password"],
                    ["确认新密码", confirm, setConfirm, "new-password"],
                  ] as const
                ).map(([label, value, setter, autoComplete], index) => (
                  <div key={label} className="space-y-1">
                    <label
                      htmlFor={`${fieldId}-${index}`}
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {label}
                    </label>
                    <input
                      id={`${fieldId}-${index}`}
                      type="password"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      autoComplete={autoComplete}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={inputStyle}
                    />
                  </div>
                ))}

                {error && (
                  <p className="text-xs" style={{ color: "var(--danger)" }}>
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-40"
                    style={{
                      background: "var(--accent-surface)",
                      border: "1px solid var(--accent)",
                      color: "var(--accent)",
                    }}
                  >
                    {saving ? "提交中…" : "确认修改"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
