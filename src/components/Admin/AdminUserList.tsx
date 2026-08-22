"use client";

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
  onBack: () => void;
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
  onBack,
}: AdminUserListProps) {
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

      <div className="hidden px-3 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={onShowOverview}
          className="w-full text-left rounded-[var(--radius)] px-3 py-2.5 transition-all duration-150"
          style={{
            background: overviewActive
              ? "var(--bg-elevated)"
              : "transparent",
            border: `1px solid ${
              overviewActive ? "var(--border-strong)" : "transparent"
            }`,
            boxShadow: overviewActive ? "var(--shadow-sm)" : "none",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="h-8 w-8 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{
                background: overviewActive
                  ? "var(--accent-surface)"
                  : "var(--bg-root)",
                color: overviewActive ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${
                  overviewActive
                    ? "color-mix(in srgb, var(--accent) 40%, transparent)"
                    : "var(--border)"
                }`,
              }}
            >
              总
            </span>
            <div className="min-w-0">
              <p
                className="text-[13px] font-semibold"
                style={{
                  color: overviewActive
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                }}
              >
                运营总览
              </p>
              <p
                className="text-[10px] mt-0.5 truncate"
                style={{ color: "var(--text-muted)" }}
              >
                统计 · 注册 · 公告
              </p>
            </div>
            {overviewActive && (
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full shrink-0"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 0 8px var(--accent-glow)",
                }}
              />
            )}
          </div>
        </button>
      </div>

      <div className="px-4 pt-3 pb-1.5 shrink-0 flex items-baseline justify-between">
        <p className="admin-kicker">用户</p>
        <p className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
          {users.length}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        {loadingUsers ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              加载用户…
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              暂无用户
            </p>
          </div>
        ) : (
          users.map((u) => {
            const banned = u.status === "banned";
            const selected = !overviewActive && selectedUser?.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelect(u)}
                className={`admin-user-row ${selected ? "is-active" : ""}`}
                style={{ opacity: banned ? 0.72 : 1 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {u.username}
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
                    {u.role === "admin" && (
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
                  <span>{u.credits ?? 0} 积分</span>
                  <span>{u.conversationCount} 对话</span>
                  <span>{u.imageCount} 图</span>
                  <span className="w-full sm:w-auto">
                    {u.lastActive ? relativeTime(u.lastActive) : "从未活跃"}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
