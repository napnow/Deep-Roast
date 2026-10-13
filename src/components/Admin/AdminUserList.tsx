"use client";

import { useMemo, useState } from "react";
import type { AdminUser } from "@/types";
import { relativeTime } from "@/types";
import { AppIcon } from "@/components/ui/icons";

interface AdminUserListProps {
  users: AdminUser[];
  selectedUser: AdminUser | null;
  overviewActive: boolean;
  siteActive: boolean;
  aiActive: boolean;
  loadingUsers: boolean;
  onShowOverview: () => void;
  onShowSite: () => void;
  onShowAi: () => void;
  onSelect: (user: AdminUser) => void;
  onOpenMobileUsers: () => void;
  onBack: () => void;
  onOpenCleanup: () => void;
  onOpenImageCleanup: () => void;
  onToggleCleanupProtected: (user: AdminUser) => void;
}

export default function AdminUserList({
  users,
  selectedUser,
  overviewActive,
  siteActive,
  aiActive,
  loadingUsers,
  onShowOverview,
  onShowSite,
  onShowAi,
  onSelect,
  onOpenMobileUsers,
  onBack,
  onOpenCleanup,
  onOpenImageCleanup,
  onToggleCleanupProtected,
}: AdminUserListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredUsers = useMemo(
    () =>
      normalizedQuery
        ? users.filter((item) =>
            item.username.toLocaleLowerCase().includes(normalizedQuery),
          )
        : users,
    [normalizedQuery, users],
  );

  return (
    <aside className="admin-rail">
      <div
        className="px-4 pt-4 pb-3 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-display text-sm font-semibold shrink-0"
                style={{
                  background:
                    "linear-gradient(145deg, var(--accent-soft), var(--accent))",
                  color: "var(--accent-on)",
                  boxShadow:
                    "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)",
                }}
                aria-hidden
              >
                焙
              </span>
              <div className="min-w-0">
                <p className="admin-title text-[1.05rem] leading-none">管理台</p>
                <p
                  className="text-[10px] mt-1 tracking-[0.14em] uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  Atelier Console
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="admin-btn admin-btn--ghost shrink-0 !px-2 !py-1 text-[11px]"
            title="返回工作台"
          >
            返回
          </button>
        </div>
      </div>

      <nav className="admin-module-nav" aria-label="管理模块">
        <button className={overviewActive ? "is-active" : ""} onClick={onShowOverview} aria-current={overviewActive ? "page" : undefined}>
          <AppIcon name="details" />运营总览
        </button>
        <button className={siteActive ? "is-active" : ""} onClick={onShowSite} aria-current={siteActive ? "page" : undefined}>
          <AppIcon name="announcement" />站点与内容
        </button>
        <button className={aiActive ? "is-active" : ""} onClick={onShowAi} aria-current={aiActive ? "page" : undefined}>
          <AppIcon name="settings" />AI 能力
        </button>
      </nav>

      <button
        type="button"
        onClick={onOpenMobileUsers}
        className="mobile-admin-user-trigger"
      >
        <AppIcon name="user" />
        用户管理
        <span>{users.length}</span>
      </button>

      <div className="px-4 pt-3 pb-1.5 shrink-0 flex items-baseline justify-between admin-user-list-header">
        <p className="admin-kicker">用户</p>
        <div className="flex items-center gap-2">
          <p className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {normalizedQuery ? `${filteredUsers.length}/${users.length}` : users.length}
          </p>
          <button
            type="button"
            onClick={onOpenCleanup}
            className="text-[9px] px-1.5 py-0.5 rounded font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "var(--danger-surface, rgba(220,38,38,0.08))",
              color: "var(--danger, #dc2626)",
              border: "1px solid var(--danger, #dc2626)",
            }}
          >
            清理 3 天未使用
          </button>
          <button
            type="button"
            onClick={onOpenImageCleanup}
            className="text-[9px] px-1.5 py-0.5 rounded font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "var(--accent-surface)",
              color: "var(--accent)",
              border: "1px solid var(--accent)",
            }}
          >
            清理所有图片
          </button>
        </div>
      </div>

      <div className="px-3 pb-2 shrink-0">
        <label className="sr-only" htmlFor="admin-user-search">
          搜索用户名
        </label>
        <input
          id="admin-user-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="搜索用户名"
          className="w-full rounded-[var(--radius)] border bg-transparent px-3 py-2 text-xs outline-none transition-colors focus:border-[var(--accent)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div className="admin-user-list flex-1 min-h-0 overflow-y-auto pb-4">
        {loadingUsers ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              加载用户…
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {normalizedQuery ? "未找到匹配用户" : "暂无用户"}
            </p>
          </div>
        ) : (
          filteredUsers.map((item) => {
            const banned = item.status === "banned";
            const selected = !overviewActive && selectedUser?.id === item.id;
            return (
              <div
                key={item.id}
                className={`admin-user-row ${selected ? "is-active" : ""}`}
                style={{ opacity: banned ? 0.72 : 1 }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="block w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[13px] font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.username}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {banned && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide"
                          style={{
                            background: "var(--danger-surface)",
                            color: "var(--danger)",
                          }}
                        >
                          封禁
                        </span>
                      )}
                      {item.cleanupProtected && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide"
                          style={{
                            background: "var(--accent-surface)",
                            color: "var(--accent)",
                          }}
                        >
                          永久保号
                        </span>
                      )}
                      {item.role === "admin" && (
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
                  </div>
                  <div
                    className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10.5px] tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span>{item.credits ?? 0} 积分</span>
                    <span>{item.conversationCount} 对话</span>
                    <span>{item.imageCount} 图</span>
                    <span className="w-full sm:w-auto">
                      {item.lastActive ? relativeTime(item.lastActive) : "从未活跃"}
                    </span>
                  </div>
                </button>
                {item.role !== "admin" && (
                  <div className="mt-1.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onToggleCleanupProtected(item)}
                      className="text-[10px] font-semibold transition-opacity hover:opacity-80"
                      style={{
                        color: item.cleanupProtected
                          ? "var(--accent)"
                          : "var(--text-muted)",
                      }}
                    >
                      {item.cleanupProtected ? "取消永久保号" : "设为永久保号"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
