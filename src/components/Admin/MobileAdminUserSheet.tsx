"use client";

import { useMemo, useState } from "react";
import type { AdminUser } from "@/types";
import { relativeTime } from "@/types";
import { AppIcon } from "@/components/ui/icons";

interface MobileAdminUserSheetProps {
  open: boolean;
  users: AdminUser[];
  selectedUser: AdminUser | null;
  loading: boolean;
  onSelect: (user: AdminUser) => void;
  onClose: () => void;
  onOpenCleanup: () => void;
  onOpenImageCleanup: () => void;
  onToggleCleanupProtected: (user: AdminUser) => void;
}

export default function MobileAdminUserSheet({
  open,
  users,
  selectedUser,
  loading,
  onSelect,
  onClose,
  onOpenCleanup,
  onOpenImageCleanup,
  onToggleCleanupProtected,
}: MobileAdminUserSheetProps) {
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

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="mobile-admin-user-sheet__backdrop"
        aria-label="关闭用户管理"
        onClick={onClose}
      />
      <section
        className="mobile-admin-user-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="选择用户"
      >
        <header className="mobile-admin-user-sheet__header">
          <div>
            <p className="admin-kicker">用户管理</p>
            <h2 className="admin-title">选择一位用户</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="admin-btn admin-btn--accent !px-2 !py-1 text-[10px]"
              onClick={onOpenImageCleanup}
            >
              清理图片
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--danger !px-2 !py-1 text-[10px]"
              onClick={onOpenCleanup}
            >
              清理 3 天未使用
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost !p-2"
              aria-label="关闭"
              onClick={onClose}
            >
              <AppIcon name="close" />
            </button>
          </div>
        </header>

        <label className="sr-only" htmlFor="mobile-admin-user-search">
          搜索用户名
        </label>
        <input
          id="mobile-admin-user-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="搜索用户名"
          className="mt-3 w-full rounded-[var(--radius)] border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />

        <div className="mobile-admin-user-sheet__list">
          {loading ? (
            <p className="mobile-admin-user-sheet__empty">加载用户…</p>
          ) : filteredUsers.length === 0 ? (
            <p className="mobile-admin-user-sheet__empty">
              {normalizedQuery ? "未找到匹配用户" : "暂无用户"}
            </p>
          ) : (
            users.map((item) => {
              if (!filteredUsers.some((candidate) => candidate.id === item.id)) {
                return null;
              }
              const banned = item.status === "banned";
              const selected = selectedUser?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`mobile-admin-user-sheet__row ${selected ? "is-active" : ""}`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelect(item)}
                  >
                    <span className="flex items-center gap-1.5">
                      <strong>{item.username}</strong>
                      {banned && <em>封禁</em>}
                      {item.cleanupProtected && <em>永久保号</em>}
                      {item.role === "admin" && <em>ADMIN</em>}
                    </span>
                    <small>
                      {item.credits ?? 0} 积分 · {item.imageCount} 图 · {item.conversationCount} 对话
                    </small>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="mobile-admin-user-sheet__time">
                      {item.lastActive ? relativeTime(item.lastActive) : "从未活跃"}
                    </span>
                    {item.role !== "admin" && (
                      <button
                        type="button"
                        className="text-[10px] font-semibold"
                        style={{
                          color: item.cleanupProtected
                            ? "var(--accent)"
                            : "var(--text-muted)",
                        }}
                        onClick={() => onToggleCleanupProtected(item)}
                      >
                        {item.cleanupProtected ? "取消保号" : "永久保号"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
