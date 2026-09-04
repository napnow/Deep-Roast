"use client";

import { useEffect, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";

export default function AdminDonationCard() {
  const [enabled, setEnabled] = useState(true);
  const [text, setText] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await apiJson<{
        donationEnabled: boolean;
        donationText: string;
        donationImagePath: string;
      }>("/api/admin/site-settings");
      setEnabled(data.donationEnabled !== false);
      setText(data.donationText || "");
      setImagePath(data.donationImagePath || "");
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
      const data = await apiJson<{ donationText: string }>(
        "/api/admin/site-settings",
        {
          method: "PUT",
          ...jsonBody({ donationText: text }),
        },
      );
      setText(data.donationText);
      setMsg("打赏文案已保存");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    }
    setSaving(false);
  }

  async function toggleEnabled(next: boolean) {
    setSaving(true);
    setMsg("");
    try {
      await apiJson("/api/admin/site-settings", {
        method: "PUT",
        ...jsonBody({ donationEnabled: next }),
      });
      setEnabled(next);
      setMsg(
        next
          ? "已开启打赏（用户端钱包可见入口）"
          : "已关闭打赏（用户端入口隐藏）",
      );
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "操作失败");
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
      const res = await fetch("/api/admin/site-settings/donation-image", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "上传失败");
      setImagePath(data.donationImagePath || "");
      setMsg("收款码已更新");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "上传失败");
    }
    setSaving(false);
  }

  async function clearImage() {
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{ donationImagePath: string }>(
        "/api/admin/site-settings",
        {
          method: "PUT",
          ...jsonBody({ clearDonationImage: true }),
        },
      );
      setImagePath(data.donationImagePath || "");
      setMsg("已清除收款码");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "清除失败");
    }
    setSaving(false);
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div>
          <p className="admin-kicker">Donation</p>
          <h2 className="admin-title text-lg mt-1">打赏设置</h2>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            上传收款码并开启后，用户端钱包弹窗内会出现「打赏支持」入口。
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
            {/* 开关 */}
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
                  打赏功能
                </p>
                <p className="text-[10.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  关闭后用户端打赏入口隐藏
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => toggleEnabled(!enabled)}
                className={`admin-btn shrink-0 ${
                  enabled ? "admin-btn--accent" : "admin-btn--danger"
                }`}
                aria-pressed={enabled}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: enabled ? "var(--success)" : "var(--danger)",
                  }}
                />
                {enabled ? "已开启" : "已关闭"}
              </button>
            </div>

            {/* 收款码 */}
            <div>
              <p
                className="text-[11px] font-semibold mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                收款码
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePath}
                    alt="收款码"
                    className="w-24 h-24 rounded-lg object-cover border"
                    style={{ borderColor: "var(--border)" }}
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-lg border border-dashed flex items-center justify-center text-[10px]"
                    style={{
                      borderColor: "var(--border-strong)",
                      color: "var(--text-muted)",
                    }}
                  >
                    未上传
                  </div>
                )}
                <label className="admin-btn admin-btn--ghost cursor-pointer">
                  {imagePath ? "更换收款码" : "上传收款码"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      onUpload(e.target.files?.[0] || null);
                      e.target.value = "";
                    }}
                  />
                </label>
                {imagePath && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={clearImage}
                    className="admin-btn admin-btn--danger text-xs"
                  >
                    删除收款码
                  </button>
                )}
              </div>
            </div>

            {/* 文案 */}
            <div>
              <p
                className="text-[11px] font-semibold mb-2"
                style={{ color: "var(--text-secondary)" }}
              >
                打赏文案（不填显示默认文案）
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="例如：如果觉得好用，请我喝杯咖啡吧 ☕"
                className="admin-input resize-y min-h-[3rem]"
              />
              <div className="flex flex-wrap gap-2 items-center mt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveText}
                  className="admin-btn admin-btn--solid"
                >
                  {saving ? "保存中…" : "保存文案"}
                </button>
                {msg && (
                  <span
                    className="text-xs animate-fade-in"
                    style={{ color: "var(--accent)" }}
                  >
                    {msg}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
