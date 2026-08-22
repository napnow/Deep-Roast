"use client";

import UserMenu from "@/components/Header/UserMenu";
import AnnouncementBell from "@/components/Header/AnnouncementBell";
import { AppIcon } from "@/components/ui/icons";
import type { WorkspaceMode } from "@/lib/workspace-preferences";

interface HeaderProps {
  activeMode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  username: string;
  role: string;
  credits: number;
  onWalletClick: () => void;
  onLogout: () => void;
  onMenuClick?: () => void;
}

const WORKSPACE_TABS: ReadonlyArray<{
  id: WorkspaceMode;
  label: string;
}> = [
  { id: "image", label: "生图" },
  { id: "chat", label: "对话" },
];

export default function Header({
  activeMode,
  onModeChange,
  username,
  role,
  credits,
  onWalletClick,
  onLogout,
  onMenuClick,
}: HeaderProps) {
  const lowCredits = credits <= 40 && role !== "admin";

  return (
    <header className="workspace-topbar relative z-20 flex items-center justify-between px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-5">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="打开菜单"
            className="ui-button ui-icon-button shrink-0 md:hidden"
          >
            <AppIcon name="menu" size={17} />
          </button>
        ) : null}

        <div className="flex shrink-0 items-baseline">
          <span className="font-display text-[1.15rem] font-semibold tracking-tight sm:text-[1.25rem]">
            深焙
          </span>
          <span className="ml-2 hidden text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] sm:inline">
            Deep Roast
          </span>
        </div>

        <div
          className="hidden items-center gap-0.5 rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-0.5 shadow-[var(--shadow-sm)] md:inline-flex"
          role="tablist"
          aria-label="工作区"
        >
          {WORKSPACE_TABS.map((tab) => {
            const selected = activeMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onModeChange(tab.id)}
                className="rounded-[8px] px-3.5 py-1.5 text-[12.8px] font-semibold transition-colors duration-150 active:scale-95"
                style={
                  selected
                    ? {
                        background: "var(--accent)",
                        color: "var(--accent-on)",
                      }
                    : {
                        background: "transparent",
                        color: "var(--text-secondary)",
                      }
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <AnnouncementBell />

        <button
          type="button"
          onClick={onWalletClick}
          aria-label={`查看钱包，当前 ${credits} 积分`}
          className="relative flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95 sm:px-3.5"
          style={{
            background: lowCredits
              ? "var(--danger-surface)"
              : "var(--bg-elevated)",
            border: `1px solid ${
              lowCredits ? "var(--danger)" : "var(--border-strong)"
            }`,
            color: lowCredits ? "var(--danger)" : "var(--text-secondary)",
          }}
        >
          <AppIcon name="wallet" size={14} />
          <span className="tabular-nums">{credits}</span>
          <span className="hidden font-medium text-[var(--text-muted)] sm:inline">
            积分
          </span>
          {lowCredits ? (
            <span className="absolute -right-1 -top-1 rounded-full bg-[var(--danger)] px-1.5 text-[9px] font-bold text-white">
              低
            </span>
          ) : null}
        </button>

        <UserMenu username={username} role={role} onLogout={onLogout} />
      </div>
    </header>
  );
}
