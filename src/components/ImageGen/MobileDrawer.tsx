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
  /** 打开既有 API Key 创建与管理弹窗 */
  onOpenApiKeys: () => void;
  /** 打开既有打赏弹窗 */
  onOpenDonation: () => void;
  /** 打开公告工作区 */
  onOpenAnnouncements: () => void;
  /** 打开对话历史 */
  onOpenChatHistory: () => void;
  /** 打开管理员已有的模型配置 */
  onOpenSettings: () => void;
  /** 进入既有管理控制台 */
  onOpenAdmin: () => void;
  /** 进入无限画布工作台 */
  onOpenCanvas?: () => void;
  /** 复用已有签到流程 */
  onCheckin: () => void;
  /** 复用已有退出登录流程 */
  onLogout: () => void;
  onClose: () => void;
}

/**
 * 手机端全局抽屉侧栏（汉堡唤起）：
 * - 高频的生图、图库、对话由主页面常驻导航承载；
 * - 抽屉保留签到、画布、会话记录、公告和主题等次级功能。
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
  onOpenApiKeys,
  onOpenDonation,
  onOpenAnnouncements,
  onOpenChatHistory,
  onOpenSettings,
  onOpenAdmin,
  onOpenCanvas,
  onCheckin,
  onLogout,
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

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next ? "#141210" : "#f8f7f4");
    setIsDark(next);
  }

  function handleLogout() {
    onClose();
    onLogout();
  }

  useEffect(() => {
    if (open) ann.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const menuItems: Array<{
    key:
      | "wallet"
      | "canvas"
      | "password"
      | "api-keys"
      | "donation"
      | "announcements"
      | "chat-history"
      | "settings"
      | "admin";
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
    ...(onOpenCanvas
      ? [
          {
            key: "canvas" as const,
            label: "作品画布",
            icon: "canvas" as AppIconName,
            desc: "进入无限节点画布串联创作",
          },
        ]
      : []),
    {
      key: "password",
      label: "修改密码",
      icon: "key",
      desc: "更新登录密码",
    },
    {
      key: "api-keys",
      label: "API 接入",
      icon: "code",
      desc: "创建、复制和管理你的 API Key",
    },
    ...(role === "admin"
      ? [
          {
            key: "settings" as const,
            label: "模型配置",
            icon: "sliders" as AppIconName,
            desc: "管理渠道和可用模型",
          },
          {
            key: "admin" as const,
            label: "管理控制台",
            icon: "layout" as AppIconName,
            desc: "运营、用户和站点管理",
          },
        ]
      : []),
    ...(donationEnabled
      ? [
          {
            key: "donation" as const,
            label: "打赏支持",
            icon: "heart" as AppIconName,
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
    if (key === "canvas") {
      onOpenCanvas?.();
      return;
    }
    if (key === "password") {
      onOpenPassword();
      return;
    }
    if (key === "api-keys") {
      onOpenApiKeys();
      return;
    }
    if (key === "settings") {
      onOpenSettings();
      return;
    }
    if (key === "admin") {
      onOpenAdmin();
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
      <div
        className="md:hidden fixed inset-0 z-40 bg-black/45 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="菜单"
        className="rd-drawer md:hidden fixed inset-y-0 left-0 z-50 w-68 max-w-[82vw] flex flex-col animate-drawer-in"
        style={{
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-mark.png"
              alt=""
              width={36}
              height={36}
              draggable={false}
              className="h-9 w-9 rounded-xl shrink-0 object-cover"
              style={{ boxShadow: "0 0 0 1px var(--border-strong)" }}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate text-[var(--text-primary)]">
                {username}
              </p>
              <p className="text-[10.5px] mt-0.5 text-[var(--text-muted)]">
                {role === "admin" ? "管理员" : "用户"} · 深焙
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--bg-elevated)] text-[var(--text-muted)]"
            aria-label="关闭菜单"
          >
            <AppIcon name="close" size={16} />
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
              {todayChecked ? <AppIcon name="check" size={14} /> : "→"}
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {menuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => handleMenuItemClick(item.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[var(--bg-elevated)] active:scale-[0.99]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 relative bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                <AppIcon name={item.icon} size={16} strokeWidth={1.8} />
                {item.unread && (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                    style={{
                      background: "var(--danger)",
                      boxShadow: "0 0 6px var(--danger)",
                    }}
                  />
                )}
              </span>
              <span className="flex-1 text-left min-w-0">
                <span className="block text-[13px] font-semibold text-[var(--text-primary)]">
                  {item.label}
                </span>
                <span className="block text-[11px] mt-0.5 truncate text-[var(--text-muted)]">
                  {item.desc}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div
          className="px-3 py-3 border-t shrink-0 space-y-2"
          style={{
            borderColor: "var(--border)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors active:scale-[0.99]"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="text-[var(--text-secondary)] shrink-0">
                <AppIcon name={isDark ? "moon" : "sun"} size={16} />
              </span>
              <span className="text-[13px] font-medium text-[var(--text-primary)]">
                深色模式
              </span>
            </span>
            <span
              className="relative inline-flex h-[22px] w-[38px] items-center rounded-full transition-colors duration-200 shrink-0"
              style={{
                background: isDark ? "var(--accent)" : "var(--bg-hover)",
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
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors hover:bg-[var(--danger-surface)] active:scale-[0.99]"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--danger)",
            }}
          >
            <AppIcon name="logout" size={16} strokeWidth={1.85} />
            <span className="text-[13px] font-semibold">退出登录</span>
          </button>
        </div>
      </div>
    </>
  );
}
