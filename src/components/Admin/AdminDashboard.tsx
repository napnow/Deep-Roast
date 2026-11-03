"use client";

interface GlobalStats { totalCheckinAmount: number; totalConsumeAmount: number; totalUsers: number; totalImages: number; bannedUsers: number; }
interface Props { globalStats: GlobalStats | null; error?: string; refreshing?: boolean; lastRefreshed?: string | null; onRefresh?: () => void; onUsers?: () => void; onAi?: () => void; onSite?: () => void; }

export default function AdminDashboard({ globalStats, error, refreshing, lastRefreshed, onRefresh, onUsers, onAi, onSite }: Props) {
  const cards = globalStats && [
    { label: "用户总数", value: globalStats.totalUsers, unit: "人", note: globalStats.bannedUsers ? `其中 ${globalStats.bannedUsers} 人已封禁` : "当前没有封禁用户", icon: "01" },
    { label: "生成图片", value: globalStats.totalImages, unit: "张", note: "历史保存的作品", icon: "02" },
    { label: "积分消耗", value: globalStats.totalConsumeAmount, unit: "积分", note: "历史消费流水合计", icon: "03" },
    { label: "签到发放", value: globalStats.totalCheckinAmount, unit: "积分", note: "历史签到积分合计", icon: "04" },
  ];
  return <div className="admin-workspace-page admin-overview">
    <header className="admin-page-heading"><div><p className="admin-overline">YOUR WORKSPACE / 运营总览</p><h1>欢迎回到管理台<span>．</span></h1><p>在这里了解深焙的运营情况，处理日常事务。</p></div><div className="admin-refresh">{lastRefreshed && <span>更新于 {lastRefreshed}</span>}{onRefresh && <button type="button" disabled={refreshing} onClick={onRefresh}>↻ {refreshing ? "刷新中…" : "刷新数据"}</button>}</div></header>
    <div className="admin-section-heading"><div><p className="admin-overline">OVERVIEW</p><h2>运营概况</h2></div><span>累计数据</span></div>
    {error && <p role="alert" className="admin-overview-loading">{error}</p>}
    {!cards ? !error && <div className="admin-overview-loading">正在汇总运营数据…</div> : <div className="admin-overview-grid">{cards.map((card) => <article key={card.label} className="admin-overview-stat"><div className="admin-overview-stat-top"><span>{card.label}</span><span>{card.icon}</span></div><div className="admin-overview-value">{card.value.toLocaleString()} <small>{card.unit}</small></div><p>{card.note}</p></article>)}</div>}
    <div className="admin-section-heading admin-section-heading--second"><div><p className="admin-overline">QUICK ACCESS</p><h2>常用管理</h2></div><span>选择要处理的事项</span></div>
    <div className="admin-quick-grid">{[{ title: "用户管理", desc: "查找用户、查看作品与积分", action: onUsers, icon: "人" }, { title: "AI 能力", desc: "配置模型积分与图像风格", action: onAi, icon: "✳" }, { title: "站点与内容", desc: "管理公告、注册与站点信息", action: onSite, icon: "▤" }].map((item) => <button key={item.title} type="button" disabled={!item.action} onClick={item.action} className="admin-quick-card"><span className="admin-quick-icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.desc}</small></span><span className="admin-quick-arrow">↗</span></button>)}</div>
    <p className="admin-overview-footnote">数据以最近一次刷新为准。</p>
  </div>;
}
