"use client";

import { useState } from "react";
import type { AdminUser } from "@/types";
import { relativeTime } from "@/types";
import { filterAdminUsers } from "./admin-directory";

interface Props {
  users: AdminUser[];
  loading: boolean;
  error?: string;
  onSelect: (user: AdminUser) => void;
  onOpenCleanup: () => void;
  onOpenImageCleanup: () => void;
  onToggleCleanupProtected: (user: AdminUser) => void;
}

export default function AdminDirectory({ users, loading, error, onSelect, onOpenCleanup, onOpenImageCleanup, onToggleCleanupProtected }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "banned">("all");
  const visible = filterAdminUsers(users, query, status);
  return <div className="admin-workspace-page">
    <section className="admin-maintenance admin-maintenance--first"><div><p className="admin-overline">MAINTENANCE / 数据清理</p><h2>数据清理</h2><p>先预览影响范围，再决定是否执行。</p></div><div className="admin-maintenance-actions"><button type="button" onClick={onOpenCleanup}>清理未使用用户</button><button type="button" onClick={onOpenImageCleanup}>清理图片</button></div></section>
    <div className="admin-page-heading"><div><p className="admin-overline">PEOPLE / 用户管理</p><h1>用户管理</h1><p>查找用户，查看作品与积分记录。</p></div><span className="admin-heading-count">共 {users.length} 位用户</span></div>
    <section className="admin-directory-card" aria-label="用户列表">
      {error && <p role="alert" className="admin-directory-empty">{error} 请返回运营总览刷新。</p>}
      <div className="admin-directory-toolbar"><label className="admin-directory-search"><span aria-hidden="true">⌕</span><span className="sr-only">搜索用户名</span><input type="search" placeholder="搜索用户名" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="admin-directory-filters" aria-label="用户状态筛选">{([ ["all", "全部"], ["active", "正常"], ["banned", "已封禁"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}</div></div>
      <div className="admin-directory-labels" aria-hidden="true"><span>用户</span><span>积分</span><span>作品</span><span>最近活跃</span><span>状态</span></div>
      {error ? null : loading ? <p className="admin-directory-empty">正在加载用户…</p> : visible.length === 0 ? <p className="admin-directory-empty">{query || status !== "all" ? "没有找到符合条件的用户" : "暂无用户"}</p> : <div>{visible.map((user) => <div key={user.id} className="admin-directory-entry"><button type="button" className="admin-directory-row" onClick={() => onSelect(user)}><span className="admin-directory-person"><span className="admin-directory-avatar">{user.username.slice(0, 1).toUpperCase()}</span><span><strong>{user.username}</strong><small>{user.role === "admin" ? "管理员" : "普通用户"}{user.cleanupProtected ? " · 已保号" : ""}</small></span></span><span className="admin-directory-number"><small>积分</small>{(user.credits ?? 0).toLocaleString()}</span><span className="admin-directory-number"><small>作品</small>{user.imageCount}</span><span className="admin-directory-time">{user.lastActive ? relativeTime(user.lastActive) : "从未活跃"}</span><span className={user.status === "banned" ? "admin-directory-status is-banned" : "admin-directory-status"}>{user.status === "banned" ? "已封禁" : "正常"}</span><span className="admin-directory-arrow" aria-hidden="true">→</span></button>{user.role !== "admin" && <button type="button" className="admin-protect-action" onClick={() => onToggleCleanupProtected(user)}>{user.cleanupProtected ? "取消保号" : "永久保号"}</button>}</div>)}</div>}
    </section>
  </div>;
}
