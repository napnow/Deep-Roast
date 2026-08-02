"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChangePasswordModal from "@/components/Auth/ChangePasswordModal";
import AnnouncementList from "@/components/AnnouncementList";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { softNavigate } from "@/lib/nav-transition";

interface UserMenuProps {
  username: string;
  role: string;
  onLogout: () => void;
  onWalletClick: () => void;
  onSettingsClick: () => void;
}

export default function UserMenu({
  username,
  role,
  onLogout,
  onWalletClick,
  onSettingsClick,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [annOpen, setAnnOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const annPanelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const ann = useAnnouncements();

  useEffect(() => {
    ann.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t)) {
        setOpen(false);
      }
      if (
        annOpen &&
        annPanelRef.current &&
        !annPanelRef.current.contains(t)
      ) {
        setAnnOpen(false);
      }
    }
    if (open || annOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, annOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
        style={{
          background: "var(--bg-root)",
          border: `1px solid ${open ? "var(--accent-soft)" : "var(--border)"}`,
          color: "var(--text-secondary)",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="truncate max-w-[56px] sm:max-w-[80px]">{username}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-44 rounded-xl border shadow-lg py-1 z-30 animate-scale-in"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <button
            onClick={() => {
              setOpen(false);
              onWalletClick();
            }}
            className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            💰 我的钱包
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setAnnOpen(true);
              ann.markSeen();
            }}
            className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 hover:opacity-80 relative"
            style={{ color: "var(--text-secondary)" }}
          >
            📢 公告
            {ann.unread && (
              <span
                className="absolute top-1/2 -translate-y-1/2 right-3 h-2 w-2 rounded-full"
                style={{
                  background: "var(--danger)",
                  boxShadow: "0 0 6px var(--danger)",
                }}
              />
            )}
          </button>
          {role === "admin" && (
            <button
              onClick={() => {
                setOpen(false);
                onSettingsClick();
              }}
              className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              ⚙ 管理员配置
            </button>
          )}
          {role === "admin" && (
            <button
              onClick={() => {
                setOpen(false);
                softNavigate(router, "/admin");
              }}
              className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              ⚙ 管理面板
            </button>
          )}
          <button
            onClick={() => {
              setOpen(false);
              setPwOpen(true);
            }}
            className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            🔑 修改密码
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            退出登录
          </button>
        </div>
      )}

      {/* 公告面板（下拉，不弹窗） */}
      {annOpen && (
        <div
          ref={annPanelRef}
          role="dialog"
          aria-label="站点公告"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(24rem,calc(100vw-1.5rem))] max-h-[min(26rem,60vh)] flex flex-col rounded-xl border shadow-lg animate-fade-in"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div
            className="flex items-center justify-between px-3.5 py-2.5 border-b shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            <p
              className="text-[13px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              站点公告
            </p>
            <button
              onClick={() => setAnnOpen(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110"
              style={{ color: "var(--text-muted)" }}
              aria-label="关闭公告"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
            <AnnouncementList items={ann.items} loading={ann.loading} />
          </div>
        </div>
      )}

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
