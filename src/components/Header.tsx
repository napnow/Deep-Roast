"use client";

import { useEffect, useRef, useState } from "react";
import UserMenu from "@/components/Header/UserMenu";

interface HeaderProps {
  /** 当前模式：image=文生图 chat=对话 */
  activeMode: "image" | "chat";
  onModeChange: (mode: "image" | "chat") => void;
  /** 当前生图模型 */
  currentModel: string;
  /** 可切换的模型列表（管理员启用） */
  modelOptions: string[];
  onModelChange: (model: string) => void;
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
  activeMode,
  onModeChange,
  currentModel,
  modelOptions,
  onModelChange,
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
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卸载时清理延迟关闭定时器
  useEffect(
    () => () => {
      if (modelMenuTimer.current) clearTimeout(modelMenuTimer.current);
    },
    [],
  );

  function openModelMenu() {
    if (modelMenuTimer.current) clearTimeout(modelMenuTimer.current);
    setModelMenuOpen(true);
  }
  function closeModelMenu(delay = 0) {
    if (modelMenuTimer.current) clearTimeout(modelMenuTimer.current);
    if (delay > 0) {
      modelMenuTimer.current = setTimeout(() => setModelMenuOpen(false), delay);
    } else {
      setModelMenuOpen(false);
    }
  }

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

        {/* 模式切换：文生图 / 对话 */}
        <div
          className="hidden md:inline-flex items-center gap-0.5 rounded-[10px] p-0.5"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {(
            [
              { id: "image", label: "文生图" },
              { id: "chat", label: "对话" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onModeChange(tab.id)}
              className={`px-3.5 py-1.5 rounded-[8px] text-[12.8px] font-semibold transition-all duration-150 active:scale-95 ${
                activeMode === tab.id ? "mode-tab-active" : ""
              }`}
              style={
                activeMode === tab.id
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
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {/* 模型切换下拉（仅文生图模式） */}
        {activeMode === "image" && (
        <div
          className="relative shrink-0"
          onMouseEnter={openModelMenu}
          onMouseLeave={() => closeModelMenu(200)}
        >
          <button
            type="button"
            onClick={() =>
              modelMenuOpen ? closeModelMenu() : openModelMenu()
            }
            title={currentModel || "未配置模型"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium max-w-[110px] sm:max-w-[220px] transition-all duration-150 active:scale-95"
            style={{
              background: "var(--bg-root)",
              border: "1px solid var(--border-strong)",
              color: "var(--text-secondary)",
            }}
          >
            <span className="truncate">{currentModel || "未配置模型"}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ transform: modelMenuOpen ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {modelMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 z-50 min-w-[220px] max-w-[280px] rounded-xl border shadow-xl py-1.5 animate-scale-in"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div
                className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                生图模型
              </div>
              {modelOptions.length === 0 && (
                <div
                  className="px-3 py-2 text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  暂无可用模型
                </div>
              )}
              {modelOptions.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onModelChange(id);
                    closeModelMenu();
                  }}
                  className="w-full text-left px-3 py-2 text-[11px] font-mono truncate transition-colors duration-100 hover:opacity-90"
                  style={{
                    background:
                      id === currentModel ? "var(--accent-surface)" : "transparent",
                    color:
                      id === currentModel ? "var(--accent)" : "var(--text-secondary)",
                    fontWeight: id === currentModel ? 600 : 400,
                  }}
                  title={id}
                >
                  {id}
                  {id === currentModel && " ✓"}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

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
