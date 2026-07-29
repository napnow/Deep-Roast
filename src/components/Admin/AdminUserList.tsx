"use client";

import type { AdminUser } from "@/types";
import { relativeTime } from "@/types";

interface AdminUserListProps {
  users: AdminUser[];
  selectedUser: AdminUser | null;
  /** true = 右侧显示运营总览（无选中用户） */
  overviewActive: boolean;
  loadingUsers: boolean;
  onShowOverview: () => void;
  onSelect: (user: AdminUser) => void;
  onBack: () => void;
}

export default function AdminUserList({
  users,
  selectedUser,
  overviewActive,
  loadingUsers,
  onShowOverview,
  onSelect,
  onBack,
}: AdminUserListProps) {
  return (
    <div
      className="w-80 shrink-0 border-r h-screen overflow-y-auto flex flex-col"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <h2 className="text-sm font-bold">管理后台</h2>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            共 {users.length} 个用户
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-xs px-2 py-1 rounded-md transition-colors duration-200"
          style={{
            color: "var(--text-muted)",
            background: "var(--bg-root)",
            border: "1px solid var(--border)",
          }}
        >
          ← 返回
        </button>
      </div>

      <div
        className="px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={onShowOverview}
          className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-100"
          style={{
            background: overviewActive
              ? "var(--accent-surface)"
              : "var(--bg-root)",
            border: `1px solid ${
              overviewActive ? "var(--accent)" : "var(--border)"
            }`,
            color: overviewActive ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          运营总览
          <span
            className="block text-[10px] font-normal mt-0.5"
            style={{
              color: overviewActive ? "var(--accent)" : "var(--text-muted)",
              opacity: 0.85,
            }}
          >
            统计 · 站点设置 · 公告
          </span>
        </button>
      </div>

      <div
        className="px-4 pt-3 pb-1 shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        <p className="text-[10px] font-semibold tracking-widest uppercase">
          用户列表
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loadingUsers ? (
          <div className="p-4 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              加载中...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-4 text-center">
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
                onClick={() => onSelect(u)}
                className="w-full text-left px-4 py-3 border-b transition-colors duration-100"
                style={{
                  borderColor: "var(--border)",
                  background: selected
                    ? "var(--accent-surface)"
                    : "transparent",
                  opacity: banned ? 0.75 : 1,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {u.username}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {banned && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
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
                        className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
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
                  className="flex gap-3 mt-1 text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span>💰 {u.credits ?? 0}</span>
                  <span>对话 {u.conversationCount}</span>
                  <span>图片 {u.imageCount}</span>
                  <span>
                    {u.lastActive ? relativeTime(u.lastActive) : "从未活跃"}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
