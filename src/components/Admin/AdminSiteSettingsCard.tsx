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
      setMsg("✓ 文案已保存");
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
      setMsg("✓ 图片已更新");
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
      setMsg("✓ 已清除图片");
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
      setMsg(next ? "✓ 已开放注册" : "✓ 已关闭注册");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "更新失败");
    }
    setSaving(false);
  }

  const inputStyle = {
    background: "var(--bg-root)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  } as const;

  return (
    <div
      className="rounded-xl border p-4 text-left space-y-3"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
    >
      <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
        站点设置
      </p>
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        注册开关与登录页「联系管理员」内容。
      </p>
      {loading ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          加载中…
        </p>
      ) : (
        <>
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: "var(--bg-root)" }}
          >
            <div>
              <p
                className="text-xs font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                开放新用户注册
              </p>
              <p
                className="text-[10px] mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                关闭后登录页隐藏注册，API 拒绝注册
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => toggleRegistration(!registrationEnabled)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{
                background: registrationEnabled
                  ? "var(--accent-surface)"
                  : "var(--danger-surface)",
                border: `1px solid ${
                  registrationEnabled ? "var(--accent)" : "var(--danger)"
                }`,
                color: registrationEnabled ? "var(--accent)" : "var(--danger)",
              }}
            >
              {registrationEnabled ? "已开放" : "已关闭"}
            </button>
          </div>

          <p
            className="text-[11px] font-semibold pt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            联系管理员
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="例如：微信 xxx / 工作日 10:00–18:00 处理重置密码"
            className="w-full rounded-lg px-3 py-2 text-xs resize-y"
            style={inputStyle}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={saving}
              onClick={saveText}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{
                background: "var(--accent-surface)",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
              }}
            >
              {saving ? "处理中…" : "保存文案"}
            </button>
            <label
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              上传图片
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
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ color: "var(--danger)" }}
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
              className="max-w-[10rem] rounded-lg border"
              style={{ borderColor: "var(--border)" }}
            />
          )}
          {msg && (
            <p
              className="text-[11px]"
              style={{
                color: msg.startsWith("✓") ? "var(--success)" : "var(--danger)",
              }}
            >
              {msg}
            </p>
          )}
        </>
      )}
    </div>
  );
}
