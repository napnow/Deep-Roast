"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon, type AppIconName } from "@/components/ui/icons";
import { softNavigate } from "@/lib/nav-transition";
import { useDeepRoastStore } from "@/lib/store";

interface UserMenuProps {
  username: string;
  role: string;
  donationEnabled?: boolean;
  onOpenDonation?: () => void;
  onLogout: () => void;
}

interface MenuItemProps {
  icon: AppIconName;
  label: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}

function MenuGroup({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border)] px-1 py-1.5 last:border-b-0">
      {label ? (
        <p className="ui-kicker px-2 pb-1 pt-0.5">{label}</p>
      ) : null}
      {children}
    </div>
  );
}

function MenuItem({ icon, label, onClick, accent, danger }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-elevated)]"
      style={{
        color: danger
          ? "var(--danger)"
          : accent
            ? "var(--accent)"
            : "var(--text-secondary)",
      }}
    >
      <AppIcon name={icon} size={15} />
      <span>{label}</span>
    </button>
  );
}

export default function UserMenu({
  username,
  role,
  donationEnabled = false,
  onOpenDonation,
  onLogout,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const setPwOpen = useDeepRoastStore((state) => state.setPwOpen);
  const setApiOpen = useDeepRoastStore((state) => state.setApiOpen);
  const setSettingsOpen = useDeepRoastStore(
    (state) => state.setSettingsOpen,
  );

  useEffect(() => {
    if (open) {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    if (open) {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggleTheme() {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem("theme", nextDark ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", nextDark ? "#141210" : "#f8f7f4");
    setIsDark(nextDark);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`打开 ${username} 的用户菜单`}
        className="flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-[var(--bg-elevated)]"
        style={{
          background: "var(--bg-surface)",
          borderColor: open ? "var(--accent)" : "var(--border-strong)",
          color: "var(--text-primary)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <AppIcon name="user" size={14} />
        <span className="max-w-[60px] truncate sm:max-w-[88px]">{username}</span>
        <AppIcon
          name="chevron-down"
          size={12}
          className={`text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 rounded-2xl border p-1.5 shadow-lg animate-scale-in"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <MenuGroup label="账户">
            <MenuItem
              icon="key"
              label="修改密码"
              onClick={() => {
                setOpen(false);
                setPwOpen(true);
              }}
            />
            <MenuItem
              icon="code"
              label="API 接入"
              onClick={() => {
                setOpen(false);
                setApiOpen(true);
              }}
            />
            {donationEnabled && onOpenDonation ? (
              <MenuItem
                icon="heart"
                label="打赏支持"
                onClick={() => {
                  setOpen(false);
                  onOpenDonation();
                }}
              />
            ) : null}
          </MenuGroup>

          <MenuGroup label="外观">
            <MenuItem
              icon={isDark ? "sun" : "moon"}
              label={isDark ? "切换为浅色模式" : "切换为深色模式"}
              onClick={toggleTheme}
            />
          </MenuGroup>

          {role === "admin" ? (
            <MenuGroup label="管理">
              <MenuItem
                icon="sliders"
                label="模型配置"
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
              />
              <MenuItem
                icon="layout"
                label="管理控制台"
                accent
                onClick={() => {
                  setOpen(false);
                  softNavigate(router, "/admin");
                }}
              />
            </MenuGroup>
          ) : null}

          <MenuGroup>
            <MenuItem
              icon="logout"
              label="退出登录"
              danger
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            />
          </MenuGroup>
        </div>
      ) : null}
    </div>
  );
}
