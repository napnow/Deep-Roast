"use client";

import { AppIcon, type AppIconName } from "@/components/ui/icons";

interface GlobalStats {
  totalCheckinAmount: number;
  totalConsumeAmount: number;
  totalUsers: number;
  totalImages: number;
  bannedUsers: number;
}

interface Props {
  globalStats: GlobalStats | null;
  error?: string;
  refreshing?: boolean;
  lastRefreshed?: string | null;
  onRefresh?: () => void;
  onUsers?: () => void;
  onAi?: () => void;
  onSite?: () => void;
}

export default function AdminDashboard({
  globalStats,
  error,
  onUsers,
  onAi,
  onSite,
}: Props) {
  const cards = globalStats && [
    {
      label: "用户总数",
      value: globalStats.totalUsers,
      unit: "人",
      note: globalStats.bannedUsers
        ? `其中 ${globalStats.bannedUsers} 人已封禁`
        : "当前没有封禁用户",
      icon: "01",
    },
    {
      label: "生成图片",
      value: globalStats.totalImages,
      unit: "张",
      note: "历史保存的作品",
      icon: "02",
    },
    {
      label: "积分消耗",
      value: globalStats.totalConsumeAmount,
      unit: "积分",
      note: "历史消费流水合计",
      icon: "03",
    },
    {
      label: "签到发放",
      value: globalStats.totalCheckinAmount,
      unit: "积分",
      note: "历史签到积分合计",
      icon: "04",
    },
  ];

  const quickActions: Array<{
    title: string;
    desc: string;
    action?: () => void;
    icon: AppIconName;
  }> = [
    {
      title: "用户管理",
      desc: "查找用户、查看作品与积分流水",
      action: onUsers,
      icon: "user",
    },
    {
      title: "AI 能力",
      desc: "配置生图计费与图生图风格预设",
      action: onAi,
      icon: "sliders",
    },
    {
      title: "站点与内容",
      desc: "管理注册风控、公告、邀请与打赏",
      action: onSite,
      icon: "announcement",
    },
  ];

  return (
    <div className="admin-workspace-page admin-overview animate-fade-up">
      <header className="admin-page-heading">
        <div>
          <p className="admin-overline">OVERVIEW · 运营总览</p>
          <h1>欢迎回到管理台</h1>
          <p>在这里查看深焙的整体运营指标，快速进入各模块处理日常事务。</p>
        </div>
      </header>

      <div className="admin-section-heading">
        <div>
          <p className="admin-overline">METRICS</p>
          <h2>核心数据</h2>
        </div>
        <span>累计统计</span>
      </div>

      {error && (
        <p role="alert" className="admin-overview-loading">
          {error}
        </p>
      )}

      {!cards ? (
        !error && (
          <div className="admin-overview-loading">正在汇总运营数据…</div>
        )
      ) : (
        <div className="admin-overview-grid">
          {cards.map((card) => (
            <article key={card.label} className="admin-overview-stat">
              <div className="admin-overview-stat-top">
                <span>{card.label}</span>
                <span>{card.icon}</span>
              </div>
              <div className="admin-overview-value">
                {card.value.toLocaleString()} <small>{card.unit}</small>
              </div>
              <p>{card.note}</p>
            </article>
          ))}
        </div>
      )}

      <div className="admin-section-heading admin-section-heading--second">
        <div>
          <p className="admin-overline">QUICK ACCESS</p>
          <h2>快捷入口</h2>
        </div>
        <span>选择要处理的模块</span>
      </div>

      <div className="admin-quick-grid">
        {quickActions.map((item) => (
          <button
            key={item.title}
            type="button"
            disabled={!item.action}
            onClick={item.action}
            className="admin-quick-card"
          >
            <span className="admin-quick-icon" aria-hidden="true">
              <AppIcon name={item.icon} size={18} />
            </span>
            <span>
              <strong>{item.title}</strong>
              <small>{item.desc}</small>
            </span>
            <span className="admin-quick-arrow" aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </span>
          </button>
        ))}
      </div>

      <p className="admin-overview-footnote">数据以最近一次刷新为准，可在右上角随时刷新。</p>
    </div>
  );
}
