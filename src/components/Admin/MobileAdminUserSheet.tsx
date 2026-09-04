"use client";

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
}

export default function MobileAdminUserSheet({
  open,
  users,
  selectedUser,
  loading,
  onSelect,
  onClose,
}: MobileAdminUserSheetProps) {
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
          <button
            type="button"
            className="admin-btn admin-btn--ghost !p-2"
            aria-label="关闭"
            onClick={onClose}
          >
            <AppIcon name="close" />
          </button>
        </header>

        <div className="mobile-admin-user-sheet__list">
          {loading ? (
            <p className="mobile-admin-user-sheet__empty">加载用户…</p>
          ) : users.length === 0 ? (
            <p className="mobile-admin-user-sheet__empty">暂无用户</p>
          ) : (
            users.map((user) => {
              const banned = user.status === "banned";
              const selected = selectedUser?.id === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  className={`mobile-admin-user-sheet__row ${selected ? "is-active" : ""}`}
                  onClick={() => onSelect(user)}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <strong>{user.username}</strong>
                      {banned && <em>封禁</em>}
                      {user.role === "admin" && <em>ADMIN</em>}
                    </span>
                    <small>
                      {user.credits ?? 0} 积分 · {user.imageCount} 图 · {user.conversationCount} 对话
                    </small>
                  </span>
                  <span className="mobile-admin-user-sheet__time">
                    {user.lastActive ? relativeTime(user.lastActive) : "从未活跃"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
