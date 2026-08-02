"use client";

import UserMenu from "@/components/Header/UserMenu";

interface HeaderProps {
  /** 当前生图模型（静态展示，不提供切换） */
  currentModel: string;
  onSettingsClick: () => void;
  username: string;
  role: string;
  onLogout: () => void;
  credits: number;
  checkinEligible: boolean;
  todayChecked: boolean;
  checkinLoading?: boolean;
  onCheckinClick: () => void;
  onWalletClick: () => void;
  /** 手机端：打开抽屉侧栏 */
  onMenuClick?: () => void;
}

export default function Header({
  currentModel,
  onSettingsClick,
  username,
  role,
  onLogout,
  credits,
  checkinEligible,
  todayChecked,
  checkinLoading,
  onCheckinClick,
  onWalletClick,
  onMenuClick,
}: HeaderProps) {
  const lowCredits = credits <= 40 && role !== "admin";

  return (
    <header
      className="dr-header-bar relative z-20 flex items-center justify-between px-5 py-2"
      style={{ minHeight: "var(--header-h)" }}
    >
      <div className="flex items-center gap-2 sm:gap-5">
        {/* 手机端汉堡：打开抽屉侧栏（ChatGPT 式） */}
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="打开菜单"
            className="md:hidden w-11 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 active:scale-95"
            style={{
              background: "var(--bg-root)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        )}
        <h1 className="font-display text-[1.15rem] sm:text-[1.25rem] font-semibold tracking-tight select-none whitespace-nowrap shrink-0">
          深焙
          <span className="ml-2 text-[10px] font-sans font-medium tracking-[0.14em] uppercase align-middle text-[var(--text-muted)] hidden sm:inline">
            Deep Roast
          </span>
        </h1>

        <span
          className="hidden md:inline-block px-3 py-1.5 rounded-[10px] text-[12.8px] font-semibold"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-sm)",
            border: "1px solid var(--border-strong)",
          }}
        >
          文生图
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {/* 当前模型静态展示 */}
        <div
          className="px-3 py-1.5 rounded-lg text-xs font-medium max-w-[110px] sm:max-w-[220px] truncate shrink-0"
          title={currentModel || "未配置模型"}
          style={{
            background: "var(--bg-root)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          {currentModel || "未配置模型"}
        </div>

        {checkinEligible && !todayChecked && (
          <button
            onClick={onCheckinClick}
            disabled={checkinLoading}
            className="hidden sm:inline-flex glass-neon-hover px-4 py-1.5 rounded-2xl text-xs font-semibold transition-all active:scale-95"
            style={{
              background: "var(--accent-surface)",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
            }}
          >
            {checkinLoading ? "签到中…" : "签到 +50"}
          </button>
        )}

        <button
          onClick={onWalletClick}
          className="flex items-center gap-1 px-2 sm:px-4 py-1.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 relative shrink-0"
          style={{
            background: lowCredits ? "var(--danger-surface)" : "var(--bg-elevated)",
            border: `1px solid ${lowCredits ? "var(--danger)" : "var(--border-strong)"}`,
            color: lowCredits ? "var(--danger)" : "var(--text-secondary)",
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: lowCredits ? "var(--danger)" : "var(--accent)",
              boxShadow: lowCredits ? "0 0 6px var(--danger)" : "0 0 6px var(--accent-glow)",
            }}
          />
          <span className="tabular-nums">{credits}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }} className="hidden sm:inline">积分</span>
          {lowCredits && (
            <span className="absolute -top-1 -right-1 text-[9px] px-1.5 rounded-full font-bold bg-[var(--danger)] text-white">
              低
            </span>
          )}
        </button>

        <UserMenu
          username={username}
          role={role}
          onLogout={onLogout}
          onWalletClick={onWalletClick}
          onSettingsClick={onSettingsClick}
        />
      </div>
    </header>
  );
}
