"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ChangePasswordModal from "@/components/Auth/ChangePasswordModal";
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
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

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
        <span className="truncate max-w-[80px]">{username}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-40 rounded-xl border shadow-lg py-1 z-30 animate-scale-in"
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
              onSettingsClick();
            }}
            className="w-full text-left px-3 py-2 text-xs transition-colors duration-100 hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            ⚙ 设置
          </button>
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
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}
