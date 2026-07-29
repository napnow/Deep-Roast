"use client";

import type { ModelInfo } from "@/types";
import ModelSelector from "@/components/Header/ModelSelector";
import UserMenu from "@/components/Header/UserMenu";

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
  onRechargeClick: () => void;
  onWalletClick: () => void;
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
  onRechargeClick,
  onWalletClick,
}: HeaderProps) {
  return (
    <header
      className="dr-header-bar relative z-20 flex items-center justify-between px-5 py-2"
      style={{ minHeight: "var(--header-h)" }}
    >
      <div className="flex items-center gap-5">
        <h1
          className="font-display text-[1.15rem] font-semibold tracking-tight select-none flex items-center gap-2.5"
          style={{ color: "var(--text-primary)" }}
        >
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm"
            style={{
              background:
                "linear-gradient(145deg, var(--accent-soft), var(--accent))",
              color: "var(--accent-on)",
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), var(--shadow-sm)",
            }}
            aria-hidden
          >
            焙
          </span>
          <span>
            深焙
            <span
              className="ml-2 text-[10px] font-sans font-medium tracking-[0.14em] uppercase align-middle"
              style={{ color: "var(--text-muted)" }}
            >
              Deep Roast
            </span>
          </span>
        </h1>

        <div
          className="flex gap-0.5 rounded-lg p-0.5"
          style={{
            background: "var(--bg-root)",
            border: "1px solid var(--border)",
          }}
        >
          {(["text", "image"] as const).map((mode) => {
            const on = activeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => setActiveMode(mode)}
                className="px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold transition-all duration-200"
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

        <button
          onClick={onSettingsClick}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:opacity-90"
          style={{
            background: "var(--bg-root)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
          title="设置"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>

        <button
          onClick={onRechargeClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-[0.98] relative"
          style={{
            background:
              credits <= 40 ? "var(--danger-surface)" : "var(--bg-elevated)",
            border: `1px solid ${
              credits <= 40 ? "var(--danger)" : "var(--border-strong)"
            }`,
            color: credits <= 40 ? "var(--danger)" : "var(--text-secondary)",
          }}
          title="充值"
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              background: credits <= 40 ? "var(--danger)" : "var(--accent)",
              boxShadow:
                credits <= 40
                  ? "0 0 6px var(--danger)"
                  : "0 0 6px var(--accent-glow)",
            }}
          />
          <span className="tabular-nums">{credits}</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
            积分
          </span>
          {credits <= 40 && (
            <span
              className="absolute -top-1 -right-1 text-[9px] px-1 rounded-full font-bold animate-pulse-soft"
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              低
            </span>
          )}
        </button>

        <UserMenu
          username={username}
          role={role}
          onLogout={onLogout}
          onWalletClick={onWalletClick}
        />
      </div>
    </header>
  );
}
