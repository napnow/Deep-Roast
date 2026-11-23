"use client";
/* eslint-disable @next/next/no-img-element */

import UserMenu from "@/components/Header/UserMenu";
import AnnouncementBell from "@/components/Header/AnnouncementBell";

export type RedesignNav = "create" | "chat" | "canvas" | "gallery";

const NAV: ReadonlyArray<{ id: RedesignNav; label: string }> = [
  { id: "create", label: "创作" },
  { id: "chat", label: "对话" },
  { id: "canvas", label: "画布" },
  { id: "gallery", label: "图库" },
];

interface RedesignTopbarProps {
  active: RedesignNav;
  onSelect: (nav: RedesignNav) => void;
  username: string;
  role: string;
  credits: number;
  onLogout: () => void;
  onWalletClick: () => void;
  checkinAvailable: boolean;
  checkinReward: number;
  checkinLoading: boolean;
  onCheckin: () => void;
  onMenuClick?: () => void;
}

export default function RedesignTopbar({
  active,
  onSelect,
  username,
  role,
  credits,
  onLogout,
  onWalletClick,
  checkinAvailable,
  checkinReward,
  checkinLoading,
  onCheckin,
  onMenuClick,
}: RedesignTopbarProps) {
  const isAdmin = role === "admin";
  return (
    <header className="rd-top">
      <div className="rd-top__left">
        {onMenuClick && (
          <button type="button" className="rd-icon rd-only-mobile" onClick={onMenuClick} aria-label="打开菜单">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        )}
        <button type="button" className="rd-brand" onClick={() => onSelect("create")} aria-label="深焙 · 回到创作">
          <img className="rd-mark" src="/brand-mark.png" alt="" width={28} height={28} draggable={false} />
          <span>深焙</span>
          <small>DEEP ROAST</small>
        </button>
      </div>

      <nav className="rd-nav" role="tablist" aria-label="工作区导航">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="rd-top__right">
        <div className="rd-credit">
          <button type="button" className="rd-credit__bal" onClick={onWalletClick} title="钱包与积分">
            <i aria-hidden="true" />
            <span>{isAdmin ? "管理员" : credits.toLocaleString()}</span>
            {!isAdmin && <small>积分</small>}
          </button>
          {checkinAvailable && (
            <button type="button" className="rd-credit__checkin" onClick={onCheckin} disabled={checkinLoading}>
              {checkinLoading ? "签到中…" : `签到 +${checkinReward}`}
            </button>
          )}
        </div>
        <div className="rd-bell"><AnnouncementBell /></div>
        <div className="rd-user"><UserMenu username={username} role={role} onLogout={onLogout} /></div>
      </div>
    </header>
  );
}
