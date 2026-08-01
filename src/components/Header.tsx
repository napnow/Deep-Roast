"use client";

import type { ModelInfo } from "@/types";
import ModelSelector from "@/components/Header/ModelSelector";
import UserMenu from "@/components/Header/UserMenu";
import AnnouncementBell from "@/components/AnnouncementBell";

interface HeaderProps {
  activeMode: "text" | "image";
  setActiveMode: (mode: "text" | "image") => void;
  currentModel: string;
  models: ModelInfo[];
  onModelChange: (model: string) => void;
  onModelRemove?: (model: string) => void;
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
  onMenuClick?: () => void;
}

export default function Header({
  activeMode,
  setActiveMode,
  currentModel,
  models,
  onModelChange,
  onModelRemove,
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
        {activeMode === "text" && onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="打开对话列表"
            className="md:hidden glass-neon-hover rounded-lg flex items-center justify-center transition-all active:scale-95"
            style={{
              background: "var(--bg-root)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              minWidth: "36px",
              minHeight: "36px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        )}
        <h1 className="font-display text-[1.15rem] font-semibold tracking-tight select-none flex items-center gap-2.5">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-sm p-1 transition-all duration-300"
            style={{
              background: "linear-gradient(145deg, var(--accent-soft), var(--accent))",
              color: "var(--accent-on)",
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), var(--shadow-sm)",
            }}
            aria-hidden
          >
            焙
          </span>
          <span>
            深焙
            <span className="ml-2 text-[10px] font-sans font-medium tracking-[0.14em] uppercase align-middle text-[var(--text-muted)] hidden sm:inline">
              Deep Roast
            </span>
          </span>
        </h1>

        <div className="flex gap-0.5 p-0.5 rounded-xl border border-white/10 glass-neon-hover">
          {(["text", "image"] as const).map((mode) => {
            const on = activeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                className={`px-4 py-1.5 rounded-[10px] text-[12.8px] font-semibold transition-all duration-200 ${on ? "active" : ""}`}
                style={
                  on
                    ? {
                        background: "var(--bg-elevated)",
                        color: "var(--text-primary)",
                        boxShadow: "var(--shadow-sm)",
                        border: "1px solid var(--border-strong)",
                      }
                    : {
                        color: "var(--text-muted)",
                        border: "1px solid transparent",
                      }
                }
              >
                {mode === "text" ? "文生文" : "文生图"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ModelSelector
          activeMode={activeMode}
          currentModel={currentModel}
          models={models}
          onModelChange={onModelChange}
          onModelRemove={onModelRemove}
        />

        <AnnouncementBell />

        {checkinEligible && !todayChecked && (
          <button
            onClick={onCheckinClick}
            disabled={checkinLoading}
            className="glass-neon-hover px-4 py-1.5 rounded-2xl text-xs font-semibold transition-all active:scale-95"
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
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-2xl text-xs font-semibold transition-all active:scale-95 relative"
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
