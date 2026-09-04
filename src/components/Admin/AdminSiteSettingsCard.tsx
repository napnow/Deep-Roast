"use client";

import { useEffect, useState } from "react";
import { apiJson, jsonBody } from "@/lib/client-api";

export default function AdminSiteSettingsCard() {
  const [text, setText] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationIpLimitEnabled, setRegistrationIpLimitEnabled] =
    useState(false);
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(true);
  const [invitationEnabled, setInvitationEnabled] = useState(true);
  const [invitationReward, setInvitationReward] = useState("200");
  const [invitationInviteeReward, setInvitationInviteeReward] = useState("50");
  const [checkinReward, setCheckinReward] = useState("50");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiJson<{
        adminContactText: string;
        adminContactImagePath: string;
        registrationEnabled?: boolean;
        registrationIpLimitEnabled?: boolean;
        imageGenerationEnabled?: boolean;
        invitationEnabled?: boolean;
        invitationReward?: number;
        invitationInviteeReward?: number;
        checkinReward?: number;
      }>("/api/admin/site-settings")
      .then((data) => {
        if (cancelled) return;
      setText(data.adminContactText || "");
      setImagePath(data.adminContactImagePath || "");
      setRegistrationEnabled(data.registrationEnabled !== false);
      setRegistrationIpLimitEnabled(data.registrationIpLimitEnabled === true);
      setImageGenerationEnabled(data.imageGenerationEnabled !== false);
      setInvitationEnabled(data.invitationEnabled !== false);
      setInvitationReward(String(data.invitationReward ?? 200));
      setInvitationInviteeReward(String(data.invitationInviteeReward ?? 50));
      setCheckinReward(String(data.checkinReward ?? 50));
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setMsg(e instanceof Error ? e.message : "加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  async function toggleRegistrationIpLimit(next: boolean) {
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{ registrationIpLimitEnabled?: boolean }>(
        "/api/admin/site-settings",
        {
          method: "PUT",
          ...jsonBody({ registrationIpLimitEnabled: next }),
        },
      );
      setRegistrationIpLimitEnabled(data.registrationIpLimitEnabled === true);
      setMsg(next ? "已开启同 IP 注册限制" : "已关闭同 IP 注册限制");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "更新失败");
    }
    setSaving(false);
  }

  async function toggleImageGeneration(next: boolean) {
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{ imageGenerationEnabled?: boolean }>(
        "/api/admin/site-settings",
        {
          method: "PUT",
          ...jsonBody({ imageGenerationEnabled: next }),
        },
      );
      setImageGenerationEnabled(data.imageGenerationEnabled !== false);
      setMsg(next ? "已开放用户生图" : "已关闭用户生图");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "更新失败");
    }
    setSaving(false);
  }

  async function toggleInvitation(next: boolean) {
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{ invitationEnabled?: boolean }>(
        "/api/admin/site-settings",
        {
          method: "PUT",
          ...jsonBody({ invitationEnabled: next }),
        },
      );
      setInvitationEnabled(data.invitationEnabled !== false);
      setMsg(next ? "已开启邀请功能" : "已关闭邀请功能");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "更新失败");
    }
    setSaving(false);
  }

  async function saveInvitationRewards() {
    const inviterRaw = invitationReward.trim();
    const inviteeRaw = invitationInviteeReward.trim();
    if (!/^\d+$/.test(inviterRaw) || !/^\d+$/.test(inviteeRaw)) {
      setMsg("两项奖励都必须是非负整数");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{
        invitationReward?: number;
        invitationInviteeReward?: number;
      }>(
        "/api/admin/site-settings",
        {
          method: "PUT",
          ...jsonBody({
            invitationReward: Number(inviterRaw),
            invitationInviteeReward: Number(inviteeRaw),
          }),
        },
      );
      setInvitationReward(String(data.invitationReward ?? inviterRaw));
      setInvitationInviteeReward(
        String(data.invitationInviteeReward ?? inviteeRaw),
      );
      setMsg("邀请奖励已保存，仅影响后续注册");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    }
    setSaving(false);
  }

  async function saveCheckinReward() {
    const raw = checkinReward.trim();
    if (!/^\d+$/.test(raw)) {
      setMsg("签到奖励必须是非负整数");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const data = await apiJson<{ checkinReward?: number }>(
        "/api/admin/site-settings",
        {
          method: "PUT",
          ...jsonBody({ checkinReward: Number(raw) }),
        },
      );
      setCheckinReward(String(data.checkinReward ?? raw));
      setMsg("签到奖励已保存，仅影响后续签到");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "保存失败");
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
            注册、生图与登录页联系方式
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
                  用户生图
                </p>
                <p
                  className="text-[10.5px] mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  关闭后普通用户与其 API Key 无法生图，管理员不受影响
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  toggleImageGeneration(!imageGenerationEnabled)
                }
                className={`admin-btn shrink-0 ${
                  imageGenerationEnabled
                    ? "admin-btn--accent"
                    : "admin-btn--danger"
                }`}
                aria-pressed={imageGenerationEnabled}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: imageGenerationEnabled
                      ? "var(--success)"
                      : "var(--danger)",
                  }}
                />
                {imageGenerationEnabled ? "开放中" : "已关闭"}
              </button>
            </div>

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
                  同 IP 注册限制
                </p>
                <p
                  className="text-[10.5px] mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  开启后同一公网 IP 只能注册一个账号
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  toggleRegistrationIpLimit(!registrationIpLimitEnabled)
                }
                className={`admin-btn shrink-0 ${
                  registrationIpLimitEnabled
                    ? "admin-btn--accent"
                    : "admin-btn--danger"
                }`}
                aria-pressed={registrationIpLimitEnabled}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    background: registrationIpLimitEnabled
                      ? "var(--success)"
                      : "var(--danger)",
                  }}
                />
                {registrationIpLimitEnabled ? "限制中" : "已关闭"}
              </button>
            </div>

            <div
              className="rounded-[var(--radius)] px-3.5 py-3 space-y-3"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    用户邀请
                  </p>
                  <p
                    className="text-[10.5px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    关闭后普通注册仍可用，但邀请码不建立关系也不发奖励
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggleInvitation(!invitationEnabled)}
                  className={`admin-btn shrink-0 ${
                    invitationEnabled ? "admin-btn--accent" : "admin-btn--danger"
                  }`}
                  aria-pressed={invitationEnabled}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: invitationEnabled
                        ? "var(--success)"
                        : "var(--danger)",
                    }}
                  />
                  {invitationEnabled ? "开放中" : "已关闭"}
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex-1 min-w-[12rem]">
                  <span
                    className="mb-1.5 block text-[11px] font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    邀请人奖励积分
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={invitationReward}
                    onChange={(e) => setInvitationReward(e.target.value)}
                    className="admin-input"
                    inputMode="numeric"
                  />
                </label>
                <label className="flex-1 min-w-[12rem]">
                  <span
                    className="mb-1.5 block text-[11px] font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    被邀请人额外奖励积分
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={invitationInviteeReward}
                    onChange={(e) => setInvitationInviteeReward(e.target.value)}
                    className="admin-input"
                    inputMode="numeric"
                  />
                </label>
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveInvitationRewards}
                  className="admin-btn admin-btn--solid"
                >
                  保存奖励设置
                </button>
              </div>
            </div>

            <div
              className="rounded-[var(--radius)] px-3.5 py-3"
              style={{
                background: "var(--bg-root)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    每日签到奖励
                  </p>
                  <p
                    className="text-[10.5px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    修改后仅影响后续签到，历史流水不会变化
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <label>
                    <span
                      className="sr-only"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      签到奖励积分
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={checkinReward}
                      onChange={(e) => setCheckinReward(e.target.value)}
                      className="admin-input w-28"
                      inputMode="numeric"
                      aria-label="每日签到奖励积分"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveCheckinReward}
                    className="admin-btn admin-btn--solid"
                  >
                    保存签到奖励
                  </button>
                </div>
              </div>
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
