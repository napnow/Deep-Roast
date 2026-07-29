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

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "var(--bg-root)", color: "var(--text-primary)" }}
    >
      <AdminUserList
        users={users}
        selectedUser={selectedUser}
        loadingUsers={loadingUsers}
        onSelect={setSelectedUser}
        onBack={() => router.push("/")}
      />

      <div className="flex-1 h-screen overflow-y-auto p-6">
        {!selectedUser ? (
          <AdminDashboard globalStats={globalStats} />
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{selectedUser.username}</h1>
                {selectedUser.status === "banned" && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{
                      background: "var(--danger-surface)",
                      color: "var(--danger)",
                    }}
                  >
                    已封禁
                  </span>
                )}
              </div>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                注册时间:{" "}
                {selectedUser.createdAt
                  ? new Date(selectedUser.createdAt).toLocaleString("zh-CN")
                  : "-"}
                {" · "}
                角色:{" "}
                {selectedUser.role === "admin" ? "管理员" : "普通用户"}
                {" · "}
                积分: 💰 {selectedUser.credits ?? 0}
                {" · "}
                对话 {selectedUser.conversationCount} · 图片{" "}
                {selectedUser.imageCount}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setResetOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  重置密码
                </button>
                {selectedUser.role !== "admin" && (
                  <>
                    <button
                      type="button"
                      disabled={userActionLoading}
                      onClick={handleToggleBan}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{
                        background:
                          selectedUser.status === "banned"
                            ? "var(--accent-surface)"
                            : "var(--danger-surface)",
                        border: `1px solid ${
                          selectedUser.status === "banned"
                            ? "var(--accent)"
                            : "var(--danger)"
                        }`,
                        color:
                          selectedUser.status === "banned"
                            ? "var(--accent)"
                            : "var(--danger)",
                      }}
                    >
                      {selectedUser.status === "banned" ? "解封" : "封禁"}
                    </button>
                    <button
                      type="button"
                      disabled={userActionLoading}
                      onClick={handleDeleteUser}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--danger)",
                        color: "var(--danger)",
                      }}
                    >
                      删除用户
                    </button>
                  </>
                )}
              </div>
            </div>

            <div
              className="flex gap-0.5 rounded-lg p-0.5"
              style={{ background: "var(--bg-root)" }}
            >
              {(["conversations", "images", "credits"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                    activeTab === tab ? "shadow-sm" : ""
                  }`}
                  style={
                    activeTab === tab
                      ? {
                          background: "var(--bg-surface)",
                          color: "var(--accent)",
                          boxShadow: "var(--shadow-sm)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {tab === "conversations"
                    ? "对话"
                    : tab === "images"
                      ? "图片"
                      : "积分"}
                </button>
              ))}
            </div>

            {loadingDetail ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                加载中...
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
                  <AdminImagesTab
                    images={images}
                    onSelect={setImageDetail}
                  />
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
