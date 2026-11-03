"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminDashboard from "@/components/Admin/AdminDashboard";
import AdminDirectory from "@/components/Admin/AdminDirectory";
import AdminUserList from "@/components/Admin/AdminUserList";
import type { AdminUser } from "@/types";

const samples: AdminUser[] = [
  { id: "1", username: "晨光工作室", role: "user", credits: 128, status: "active", cleanupProtected: true, conversationCount: 8, imageCount: 36, createdAt: "2026-10-01T00:00:00Z", lastActive: "2026-11-01T08:00:00Z" },
  { id: "2", username: "林间设计", role: "user", credits: 86, status: "active", cleanupProtected: false, conversationCount: 12, imageCount: 24, createdAt: "2026-10-03T00:00:00Z", lastActive: "2026-10-31T08:00:00Z" },
  { id: "3", username: "Roast Studio", role: "admin", credits: 0, status: "active", cleanupProtected: false, conversationCount: 6, imageCount: 18, createdAt: "2026-09-01T00:00:00Z", lastActive: "2026-10-30T08:00:00Z" },
  { id: "4", username: "一颗咖啡豆", role: "user", credits: 12, status: "banned", cleanupProtected: false, conversationCount: 2, imageCount: 5, createdAt: "2026-10-10T00:00:00Z", lastActive: null },
];
type View = "overview" | "users" | "detail" | "site" | "ai";

export default function AdminDemo() {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [users, setUsers] = useState(samples);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detailTab, setDetailTab] = useState("图片");
  const notice = () => window.alert("本地示例预览，不会执行真实管理操作。");
  if (process.env.NODE_ENV !== "development") return null;
  return <div className="admin-demo-wrap"><div className="admin-demo-notice">本地管理台预览 · 全部为示例数据，不连接线上后台</div><div className="admin-shell admin-demo-shell">
    <AdminUserList users={users} selectedUser={selected} overviewActive={view === "overview"} usersActive={view === "users" || view === "detail"} siteActive={view === "site"} aiActive={view === "ai"} loadingUsers={false} onShowOverview={() => setView("overview")} onShowUsers={() => setView("users")} onShowSite={() => setView("site")} onShowAi={() => setView("ai")} onSelect={(u) => { setSelected(u); setView("detail"); }} onOpenMobileUsers={() => setView("users")} onBack={() => router.push("/?preview=mobile")} onOpenCleanup={notice} onOpenImageCleanup={notice} onToggleCleanupProtected={(u) => setUsers((all) => all.map((item) => item.id === u.id ? { ...item, cleanupProtected: !item.cleanupProtected } : item))} />
    <main className="admin-main">
      {view === "overview" && <AdminDashboard globalStats={{ totalUsers: 4, totalImages: 83, totalConsumeAmount: 2450, totalCheckinAmount: 3800, bannedUsers: 1 }} onRefresh={() => {}} lastRefreshed="示例数据" onUsers={() => setView("users")} onAi={() => setView("ai")} onSite={() => setView("site")} />}
      {view === "users" && <AdminDirectory users={users} loading={false} onSelect={(u) => { setSelected(u); setDetailTab("图片"); setView("detail"); }} onOpenCleanup={notice} onOpenImageCleanup={notice} onToggleCleanupProtected={(u) => setUsers((all) => all.map((item) => item.id === u.id ? { ...item, cleanupProtected: !item.cleanupProtected } : item))} />}
      {view === "detail" && selected && <div className="admin-workspace-page"><button className="admin-demo-back" onClick={() => setView("users")}>← 返回用户管理</button><div className="admin-page-heading"><div><p className="admin-overline">USER PROFILE / 用户详情</p><h1>{selected.username}</h1><p>{selected.role === "admin" ? "管理员" : "普通用户"} · {selected.status === "banned" ? "已封禁" : "正常"} · {selected.credits} 积分</p></div><span className="admin-heading-count">示例用户</span></div><div className="admin-demo-tabs" role="tablist">{["图片", "对话", "积分", "API Key"].map((name) => <button key={name} role="tab" aria-selected={detailTab === name} onClick={() => setDetailTab(name)}>{name}</button>)}</div><div className="admin-demo-detail"><strong>{detailTab}记录</strong><p>此处展示该用户的{detailTab}记录，预览不加载真实数据。</p></div></div>}
      {(view === "site" || view === "ai") && <div className="admin-workspace-page"><div className="admin-page-heading"><div><p className="admin-overline">SETTINGS / 管理设置</p><h1>{view === "ai" ? "AI 能力" : "站点与内容"}</h1><p>{view === "ai" ? "管理模型积分、图像风格和测试。" : "管理公告、注册、邀请码与站点信息。"}</p></div></div><div className="admin-demo-detail"><strong>现有功能页面</strong><p>本次预览聚焦总览和用户管理；这个模块保留原有功能，暂未在示例中加载。</p></div></div>}
    </main>
  </div></div>;
}
