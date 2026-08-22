"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppIcon, type AppIconName } from "@/components/ui/icons";
import { softNavigate } from "@/lib/nav-transition";
import { useDeepRoastStore } from "@/lib/store";

interface UserMenuProps {
  username: string;
  role: string;
  onLogout: () => void;
}

interface MenuItemProps {
  icon: AppIconName;
  label: string;
  onClick: () => void;
  accent?: boolean;
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

function MenuItem({ icon, label, onClick, accent }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--bg-elevated)]"
      style={{ color: accent ? "var(--accent)" : "var(--text-secondary)" }}
    >
      <AppIcon name={icon} size={15} />
      <span>{label}</span>
    </button>
  );
}

export default function UserMenu({
  username,
  role,
  onLogout,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const setPwOpen = useDeepRoastStore((state) => state.setPwOpen);
  const setApiOpen = useDeepRoastStore((state) => state.setApiOpen);
  const setSettingsOpen = useDeepRoastStore(
    (state) => state.setSettingsOpen,
  );

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggleTheme() {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem("theme", nextDark ? "dark" : "light");
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
        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
        style={{
          background: "var(--bg-root)",
          borderColor: open ? "var(--accent-soft)" : "var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        <AppIcon name="user" size={14} />
        <span className="max-w-[56px] truncate sm:max-w-[80px]">{username}</span>
        <AppIcon
          name="chevron-down"
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-52 rounded-xl border p-1 shadow-lg animate-scale-in"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border)",
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
              icon="details"
              label="API 接入"
              onClick={() => {
                setOpen(false);
                setApiOpen(true);
              }}
            />
          </MenuGroup>

          <MenuGroup label="站点">
            <MenuItem icon="settings" label="主题设置" onClick={toggleTheme} />
          </MenuGroup>

          {role === "admin" ? (
            <MenuGroup label="管理">
              <MenuItem
                icon="settings"
                label="模型配置"
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
              />
              <MenuItem
                icon="settings"
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
              icon="arrow-left"
              label="退出登录"
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
