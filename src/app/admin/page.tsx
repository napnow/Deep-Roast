"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type {
  AdminUser,
  Conversation,
  Message,
  ImageRecord,
  CreditTransaction,
} from "@/types";
import AdminUserList from "@/components/Admin/AdminUserList";
import AdminDashboard from "@/components/Admin/AdminDashboard";
import AdminConversationsTab from "@/components/Admin/AdminConversationsTab";
import AdminImagesTab from "@/components/Admin/AdminImagesTab";
import AdminCreditsTab from "@/components/Admin/AdminCreditsTab";
import AdminImageDetailModal from "@/components/Admin/AdminImageDetailModal";
import ResetPasswordModal from "@/components/Admin/ResetPasswordModal";

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<Message[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [imageDetail, setImageDetail] = useState<ImageRecord | null>(null);
  const [creditTx, setCreditTx] = useState<CreditTransaction[]>([]);
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "conversations" | "images" | "credits"
  >("conversations");
  const [globalStats, setGlobalStats] = useState<{
    totalCheckinAmount: number;
    totalConsumeAmount: number;
    totalUsers: number;
    totalImages: number;
    bannedUsers: number;
  } | null>(null);
  const [userActionLoading, setUserActionLoading] = useState(false);
  /** 右侧主面板：总览 或 用户详情（选用户时自动切到 detail） */
  const [mainView, setMainView] = useState<"overview" | "detail">("overview");

  useEffect(() => {
    if (!loading && user && user.role !== "admin") {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(console.error)
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (users.length === 0) return;
    fetch("/api/admin/credits")
      .then((res) => res.json())
      .then((data) => {
        if (data?.stats) {
          setGlobalStats({
            totalCheckinAmount: data.stats.totalCheckinAmount || 0,
            totalConsumeAmount: data.stats.totalConsumeAmount || 0,
            totalUsers: users.length,
            totalImages: users.reduce(
              (sum, u) => sum + (u.imageCount || 0),
              0,
            ),
            bannedUsers: users.filter((u) => u.status === "banned").length,
          });
        }
      })
      .catch(console.error);
  }, [users]);

  async function refreshUsers() {
    const d = await fetch("/api/admin/users").then((r) => r.json());
    if (Array.isArray(d)) setUsers(d);
    return d as AdminUser[];
  }

  async function handleToggleBan() {
    if (!selectedUser || selectedUser.role === "admin" || userActionLoading)
      return;
    const next = selectedUser.status === "banned" ? "active" : "banned";
    const label = next === "banned" ? "封禁" : "解封";
    if (!confirm(`确认${label}用户「${selectedUser.username}」？`)) return;
    setUserActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `${label}失败`);
      } else {
        const list = await refreshUsers();
        const updated = list.find((u) => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
        else setSelectedUser({ ...selectedUser, status: next });
      }
    } catch {
      alert("网络错误");
    }
    setUserActionLoading(false);
  }

  async function handleDeleteUser() {
    if (!selectedUser || selectedUser.role === "admin" || userActionLoading)
      return;
    if (
      !confirm(
        `确认永久删除用户「${selectedUser.username}」？对话、图片与积分流水将一并删除，不可恢复。`,
      )
    ) {
      return;
    }
    setUserActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "删除失败");
      } else {
        setSelectedUser(null);
        setMainView("overview");
        await refreshUsers();
      }
    } catch {
      alert("网络错误");
    }
    setUserActionLoading(false);
  }

  useEffect(() => {
    if (!selectedUser) {
      setConversations([]);
      setImages([]);
      return;
    }
    setLoadingDetail(true);
    setExpandedConv(null);
    setConvMessages([]);
    setActiveTab("conversations");

    Promise.all([
      fetch(`/api/admin/users/${selectedUser.id}/conversations`).then((r) =>
        r.json(),
      ),
      fetch(`/api/admin/users/${selectedUser.id}/images`).then((r) =>
        r.json(),
      ),
      fetch(`/api/admin/credits?userId=${selectedUser.id}`).then((r) =>
        r.json(),
      ),
    ])
      .then(([convs, imgs, credData]) => {
        if (Array.isArray(convs)) setConversations(convs);
        if (Array.isArray(imgs)) setImages(imgs);
        if (credData?.transactions) setCreditTx(credData.transactions);
      })
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedUser]);

  async function loadMessages(conversationId: string) {
    if (expandedConv === conversationId) {
      setExpandedConv(null);
      setConvMessages([]);
      return;
    }
    setExpandedConv(conversationId);
    try {
      const res = await fetch(
        `/api/admin/users/${selectedUser!.id}/messages?conversationId=${conversationId}`,
      );
      const data = await res.json();
      if (Array.isArray(data)) setConvMessages(data);
    } catch {
      console.error("Failed to load messages");
    }
  }

  async function handleCreditsAdjust() {
    if (!selectedUser || !adjustAmount || adjustLoading) return;
    setAdjustLoading(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: adjustAmount,
          note: adjustNote,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "调配失败");
      } else {
        const data = await res.json();
        setAdjustAmount(0);
        setAdjustNote("");
        const credRes = await fetch(
          `/api/admin/credits?userId=${selectedUser.id}`,
        ).then((r) => r.json());
        if (credRes?.transactions) setCreditTx(credRes.transactions);
        setSelectedUser({ ...selectedUser, credits: data.balance });
        fetch("/api/admin/users")
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d)) setUsers(d);
          });
      }
    } catch {
      alert("网络错误");
    }
    setAdjustLoading(false);
  }

  if (loading || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-canvas)", color: "var(--text-muted)" }}
      >
        <p className="text-sm tracking-wide">加载管理台…</p>
      </div>
    );
  }

  const initial =
    selectedUser?.username?.slice(0, 1)?.toUpperCase() || "·";

  return (
    <div className="admin-shell">
      <AdminUserList
        users={users}
        selectedUser={selectedUser}
        overviewActive={mainView === "overview"}
        loadingUsers={loadingUsers}
        onShowOverview={() => setMainView("overview")}
        onSelect={(u) => {
          setSelectedUser(u);
          setMainView("detail");
        }}
        onBack={() => router.push("/")}
      />

      <div className="admin-main">
        {mainView === "overview" || !selectedUser ? (
          <AdminDashboard globalStats={globalStats} />
        ) : (
          <div className="max-w-5xl mx-auto space-y-5 animate-fade-up">
            {/* User dossier header */}
            <section className="admin-card overflow-hidden">
              <div
                className="h-1.5 w-full"
                style={{
                  background:
                    selectedUser.status === "banned"
                      ? "linear-gradient(90deg, var(--danger), transparent)"
                      : "linear-gradient(90deg, var(--accent-soft), var(--accent), transparent)",
                }}
              />
              <div className="admin-card-body !pt-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span
                      className="h-12 w-12 rounded-[var(--radius)] flex items-center justify-center font-display text-xl font-semibold shrink-0"
                      style={{
                        background:
                          selectedUser.status === "banned"
                            ? "var(--danger-surface)"
                            : "var(--accent-surface)",
                        color:
                          selectedUser.status === "banned"
                            ? "var(--danger)"
                            : "var(--accent)",
                        border: `1px solid ${
                          selectedUser.status === "banned"
                            ? "color-mix(in srgb, var(--danger) 35%, transparent)"
                            : "color-mix(in srgb, var(--accent) 35%, transparent)"
                        }`,
                      }}
                      aria-hidden
                    >
                      {initial}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMainView("overview")}
                          className="admin-btn admin-btn--ghost !px-2 !py-0.5 text-[11px]"
                        >
                          ← 运营总览
                        </button>
                        {selectedUser.status === "banned" && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide"
                            style={{
                              background: "var(--danger-surface)",
                              color: "var(--danger)",
                            }}
                          >
                            已封禁
                          </span>
                        )}
                        {selectedUser.role === "admin" && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide"
                            style={{
                              background: "var(--accent-surface)",
                              color: "var(--accent)",
                            }}
                          >
                            ADMIN
                          </span>
                        )}
                      </div>
                      <h1 className="admin-title text-[1.55rem] mt-1.5 truncate">
                        {selectedUser.username}
                      </h1>
                      <p
                        className="text-[11.5px] mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span>
                          注册{" "}
                          {selectedUser.createdAt
                            ? new Date(selectedUser.createdAt).toLocaleString(
                                "zh-CN",
                              )
                            : "-"}
                        </span>
                        <span>·</span>
                        <span>
                          {selectedUser.role === "admin"
                            ? "管理员"
                            : "普通用户"}
                        </span>
                        <span>·</span>
                        <span className="font-semibold" style={{ color: "var(--accent)" }}>
                          {selectedUser.credits ?? 0} 积分
                        </span>
                        <span>·</span>
                        <span>{selectedUser.conversationCount} 对话</span>
                        <span>·</span>
                        <span>{selectedUser.imageCount} 图</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setResetOpen(true)}
                      className="admin-btn admin-btn--ghost"
                    >
                      重置密码
                    </button>
                    {selectedUser.role !== "admin" && (
                      <>
                        <button
                          type="button"
                          disabled={userActionLoading}
                          onClick={handleToggleBan}
                          className={`admin-btn ${
                            selectedUser.status === "banned"
                              ? "admin-btn--accent"
                              : "admin-btn--danger"
                          }`}
                        >
                          {selectedUser.status === "banned" ? "解封" : "封禁"}
                        </button>
                        <button
                          type="button"
                          disabled={userActionLoading}
                          onClick={handleDeleteUser}
                          className="admin-btn admin-btn--danger"
                        >
                          删除用户
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Segmented tabs */}
            <div
              className="inline-flex gap-0.5 rounded-[var(--radius)] p-1"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
              role="tablist"
            >
              {(
                [
                  {
                    key: "conversations" as const,
                    label: "对话",
                    count: conversations.length,
                  },
                  {
                    key: "images" as const,
                    label: "图片",
                    count: images.length,
                  },
                  {
                    key: "credits" as const,
                    label: "积分",
                    count: creditTx.length,
                  },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.key)}
                    className="px-3.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold transition-all duration-150"
                    style={
                      active
                        ? {
                            background: "var(--accent-surface)",
                            color: "var(--accent)",
                            boxShadow: "var(--shadow-sm)",
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    {tab.label}
                    <span
                      className="ml-1.5 tabular-nums text-[10px] opacity-70"
                    >
                      {loadingDetail ? "…" : tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {loadingDetail ? (
              <p className="text-sm py-8" style={{ color: "var(--text-muted)" }}>
                加载用户档案…
              </p>
            ) : (
              <>
                {activeTab === "conversations" && (
                  <AdminConversationsTab
                    conversations={conversations}
                    expandedConv={expandedConv}
                    convMessages={convMessages}
                    onToggle={loadMessages}
                  />
                )}
                {activeTab === "images" && (
                  <AdminImagesTab images={images} onSelect={setImageDetail} />
                )}
                {activeTab === "credits" && (
                  <AdminCreditsTab
                    creditTx={creditTx}
                    adjustAmount={adjustAmount}
                    adjustNote={adjustNote}
                    adjustLoading={adjustLoading}
                    onAmountChange={setAdjustAmount}
                    onNoteChange={setAdjustNote}
                    onAdjust={handleCreditsAdjust}
                  />
                )}
                {imageDetail && (
                  <AdminImageDetailModal
                    image={imageDetail}
                    onClose={() => setImageDetail(null)}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      <ResetPasswordModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        user={
          selectedUser
            ? { id: selectedUser.id, username: selectedUser.username }
            : null
        }
      />
    </div>
  );
}
