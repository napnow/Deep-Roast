"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getMobileCheckinCard } from "@/components/Workspace/mobile-workspace-ui";
import { AppIcon, type AppIconName } from "@/components/ui/icons";
import { useAnnouncements } from "@/hooks/useAnnouncements";

interface MobileDrawerProps {
  open: boolean;
  checkinEligible: boolean;
  todayChecked: boolean;
  checkinReward: number;
  checkinLoading: boolean;
  donationEnabled: boolean;
  /** 打开既有钱包（积分、邀请、积分流水） */
  onOpenWallet: () => void;
  /** 打开既有修改密码弹窗 */
  onOpenPassword: () => void;
  /** 打开既有打赏弹窗 */
  onOpenDonation: () => void;
  /** 打开公告工作区 */
  onOpenAnnouncements: () => void;
  /** 打开对话历史 */
  onOpenChatHistory: () => void;
  /** 复用已有签到流程 */
  onCheckin: () => void;
  onClose: () => void;
}

/**
 * 手机端全局抽屉侧栏（汉堡唤起）：
 * - 高频的生图、图库、对话由主页面常驻导航承载；
 * - 抽屉只保留签到、会话记录、公告和主题等次级功能。
 */
export default function MobileDrawer({
  open,
  checkinEligible,
  todayChecked,
  checkinReward,
  checkinLoading,
  donationEnabled,
  onOpenWallet,
  onOpenPassword,
  onOpenDonation,
  onOpenAnnouncements,
  onOpenChatHistory,
  onCheckin,
  onClose,
}: MobileDrawerProps) {
  const { user } = useAuth();
  const username = user?.username || "";
  const role = user?.role || "user";
  const ann = useAnnouncements();
  const checkinCard = getMobileCheckinCard({
    eligible: checkinEligible,
    todayChecked,
    loading: checkinLoading,
    reward: checkinReward,
  });

  // 主题切换（.dark class + localStorage「theme」；跟随 layout.tsx 的初始化脚本）
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, [open]);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  // 打开抽屉时刷新公告红点
  useEffect(() => {
    if (open) ann.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const menuItems: Array<{
    key: "wallet" | "password" | "donation" | "announcements" | "chat-history";
    label: string;
    icon: AppIconName;
    desc: string;
    unread?: boolean;
  }> = [
    {
      key: "wallet",
      label: "积分与邀请",
      icon: "wallet",
      desc: "查看余额、积分明细和邀请链接",
    },
    {
      key: "password",
      label: "修改密码",
      icon: "key",
      desc: "更新登录密码",
    },
    ...(donationEnabled
      ? [
          {
            key: "donation" as const,
            label: "打赏支持",
            icon: "details" as AppIconName,
            desc: "支持深焙持续运营",
          },
        ]
      : []),
    {
      key: "chat-history",
      label: "会话记录",
      icon: "history",
      desc: "查看和管理历史对话",
    },
    {
      key: "announcements",
      label: "公告",
      icon: "announcement",
      desc: ann.unread ? "有新公告" : "查看站点公告",
      unread: ann.unread,
    },
  ];

  function handleMenuItemClick(
    key: (typeof menuItems)[number]["key"],
  ) {
    onClose();
    if (key === "wallet") {
      onOpenWallet();
      return;
    }
    if (key === "password") {
      onOpenPassword();
      return;
    }
    if (key === "donation") {
      onOpenDonation();
      return;
    }
    if (key === "chat-history") {
      onOpenChatHistory();
      return;
    }
    onOpenAnnouncements();
  }

  return (
    <>
      {/* 遮罩 */}
      <div
        className="md:hidden fixed inset-0 z-40 bg-black/45 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      {/* 抽屉 */}
      <div
        role="dialog"
        aria-label="菜单"
        className="md:hidden fixed inset-y-0 left-0 z-50 w-64 max-w-[78vw] flex flex-col animate-drawer-in"
        style={{
          background:
            "color-mix(in srgb, var(--bg-surface) 92%, transparent)",
          backdropFilter: "blur(20px) saturate(1.2)",
          WebkitBackdropFilter: "blur(20px) saturate(1.2)",
          borderRight: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* 头部 */}
        <div
          className="flex items-center justify-between px-4 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm shrink-0"
              style={{
                background:
                  "linear-gradient(145deg, var(--accent-soft), var(--accent))",
                color: "var(--accent-on)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              焙
            </span>
            <div className="min-w-0">
              <p
                className="text-[13px] font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {username}
              </p>
              <p
                className="text-[10px] mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {role === "admin" ? "管理员" : "用户"} · 深焙
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 hover:scale-110 active:scale-95"
            style={{ color: "var(--text-muted)" }}
            aria-label="关闭菜单"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-3 pt-3 shrink-0">
          <button
            type="button"
            className="mobile-checkin-card"
            onClick={onCheckin}
            disabled={checkinCard.disabled}
          >
            <span className="min-w-0 text-left">
              <strong>{checkinCard.label}</strong>
              <small>{checkinCard.detail}</small>
            </span>
            <span className="mobile-checkin-card__indicator" aria-hidden="true">
              {todayChecked ? "✓" : "→"}
            </span>
          </button>
        </div>

        {/* 菜单项 */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
          {menuItems.map((item) => {
            return (
              <button
                key={item.key}
                onClick={() => handleMenuItemClick(item.key)}
                className="w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl transition-all duration-150 active:scale-[0.98]"
                style={{
                  background: "transparent",
                  border: "1px solid transparent",
                }}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center shrink-0 relative"
                  style={{
                    color: "var(--text-muted)",
                  }}
                >
                  <AppIcon name={item.icon} size={18} strokeWidth={1.8} />
                  {item.unread && (
                    <span
                      className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full"
                      style={{
                        background: "var(--danger)",
                        boxShadow: "0 0 6px var(--danger)",
                      }}
                    />
                  )}
                </span>
                <span className="flex-1 text-left min-w-0">
                  <span
                    className="block text-[13px] font-semibold"
                    style={{
                      color: "var(--text-primary)",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="block text-[10.5px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* 底部：主题切换 */}
        <div
          className="px-3 py-3 border-t shrink-0 space-y-2"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98]"
            style={{
              background: "var(--bg-root)",
              border: "1px solid var(--border)",
            }}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span
                className="text-[15px] leading-none shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                {isDark ? "🌙" : "☀️"}
              </span>
              <span
                className="text-[13px] font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                深色模式
              </span>
            </span>
            {/* 开关 */}
            <span
              className={`relative inline-flex h-[22px] w-[38px] items-center rounded-full transition-colors duration-200 shrink-0 ${
                isDark ? "" : ""
              }`}
              style={{
                background: isDark ? "var(--accent)" : "var(--bg-elevated)",
                border: `1px solid ${
                  isDark ? "var(--accent)" : "var(--border-strong)"
                }`,
              }}
            >
              <span
                className="inline-block h-[16px] w-[16px] transform rounded-full bg-white shadow transition-transform duration-200"
                style={{
                  transform: isDark ? "translateX(17px)" : "translateX(2px)",
                }}
              />
            </span>
          </button>
          <p className="text-[10px] px-1" style={{ color: "var(--text-muted)" }}>
            深焙 Deep Roast · 慢工出好图
          </p>
        </div>
      </div>
    </>
  );
}
