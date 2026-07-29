"use client";

import { useEffect, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";

export default function AdminSiteSettingsCard() {
  const [text, setText] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<{
        adminContactText: string;
        adminContactImagePath: string;
        registrationEnabled?: boolean;
      }>("/api/admin/site-settings");
      setText(data.adminContactText || "");
      setImagePath(data.adminContactImagePath || "");
      setRegistrationEnabled(data.registrationEnabled !== false);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "加载失败");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveText() {
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{
        adminContactText: string;
        adminContactImagePath: string;
      }>("/api/admin/site-settings", {
        method: "PUT",
        ...jsonBody({ adminContactText: text }),
      });
      setText(data.adminContactText);
      setImagePath(data.adminContactImagePath);
      setMsg("文案已保存");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    }
    setSaving(false);
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    setSaving(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/site-settings/contact-image", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      setImagePath(data.adminContactImagePath || "");
      setMsg("图片已更新");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "上传失败");
    }
    setSaving(false);
  }

  async function clearImage() {
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{
        adminContactText: string;
        adminContactImagePath: string;
      }>("/api/admin/site-settings", {
        method: "PUT",
        ...jsonBody({ clearImage: true }),
      });
      setImagePath(data.adminContactImagePath || "");
      setMsg("已清除图片");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "清除失败");
    }
    setSaving(false);
  }

  async function toggleRegistration(next: boolean) {
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{ registrationEnabled?: boolean }>(
        "/api/admin/site-settings",
        {
          method: "PUT",
          ...jsonBody({ registrationEnabled: next }),
        },
      );
      setRegistrationEnabled(data.registrationEnabled !== false);
      setMsg(next ? "已开放注册" : "已关闭注册");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "更新失败");
    }
    setSaving(false);
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <p className="admin-kicker">Site</p>
          <h2 className="admin-title text-lg mt-1">站点设置</h2>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            注册闸门与登录页联系方式
          </p>
        </div>
      </div>
      <div className="admin-card-body space-y-4">
        {loading ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            加载中…
          </p>
        ) : (
          <>
            <div
              className="flex items-center justify-between gap-3 rounded-[var(--radius)] px-3.5 py-3"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="min-w-0">
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  新用户注册
                </p>
                <p
                  className="text-[10.5px] mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  关闭后隐藏注册入口，API 拒绝注册
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => toggleRegistration(!registrationEnabled)}
                className={`admin-btn shrink-0 ${
                  registrationEnabled
                    ? "admin-btn--accent"
                    : "admin-btn--danger"
                }`}
                aria-pressed={registrationEnabled}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: registrationEnabled
                      ? "var(--success)"
                      : "var(--danger)",
                  }}
                />
                {registrationEnabled ? "开放中" : "已关闭"}
              </button>
            </div>

            <div>
              <p
                className="text-[11px] font-semibold mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                联系管理员
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="例如：微信 xxx · 工作日 10:00–18:00"
                className="admin-input resize-y min-h-[5.5rem]"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                disabled={saving}
                onClick={saveText}
                className="admin-btn admin-btn--solid"
              >
                {saving ? "处理中…" : "保存文案"}
              </button>
              <label className="admin-btn admin-btn--ghost cursor-pointer">
                上传二维码
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => onUpload(e.target.files?.[0] || null)}
                />
              </label>
              {imagePath && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={clearImage}
                  className="admin-btn admin-btn--danger"
                >
                  清除图片
                </button>
              )}
            </div>

            {imagePath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePath}
                alt="当前交流群图"
                className="max-w-[9rem] rounded-[var(--radius)] border"
                style={{
                  borderColor: "var(--border-strong)",
                  boxShadow: "var(--shadow-sm)",
                }}
              />
            )}

            {msg && (
              <p
                className="text-[11px] font-medium"
                style={{
                  color: /失败|错误/.test(msg)
                    ? "var(--danger)"
                    : "var(--success)",
                }}
              >
                {msg}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
