"use client";

import AdminSiteSettingsCard from "@/components/Admin/AdminSiteSettingsCard";
import AdminAnnouncementsCard from "@/components/Admin/AdminAnnouncementsCard";
import AdminStylesCard from "@/components/Admin/AdminStylesCard";
import AdminStyleTestCard from "@/components/Admin/AdminStyleTestCard";
import { CREDIT_PER_IMAGE } from "@/types";

interface GlobalStats {
  totalCheckinAmount: number;
  totalConsumeAmount: number;
  totalUsers: number;
  totalImages: number;
  bannedUsers: number;
}

interface AdminDashboardProps {
  globalStats: GlobalStats | null;
  refreshing?: boolean;
  lastRefreshed?: string | null;
  onRefresh?: () => void;
}

export default function AdminDashboard({
  globalStats,
  refreshing = false,
  lastRefreshed = null,
  onRefresh,
}: AdminDashboardProps) {
  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-7 animate-fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="admin-kicker">Operations</p>
            <h1 className="admin-title text-[1.85rem] mt-1.5">运营总览</h1>
            <p
              className="text-sm mt-2 max-w-xl leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              签到与消耗、站点开关与公告。左侧选择用户可审计对话、图片与积分流水。
            </p>
          </div>
          {onRefresh && (
            <div className="flex items-center gap-2.5 shrink-0">
              {lastRefreshed && (
                <span
                  className="text-[11px] tabular-nums"
                  style={{ color: "var(--text-muted)" }}
                >
                  更新于 {lastRefreshed}
                </span>
              )}
              <button
                type="button"
                disabled={refreshing}
                onClick={onRefresh}
                className="admin-btn admin-btn--ghost"
                title="重新拉取用户、统计与图片数据"
              >
                <span
                  aria-hidden
                  className="inline-block mr-1.5"
                  style={
                    refreshing
                      ? {
                          display: "inline-block",
                          animation: "spin 0.8s linear infinite",
                        }
                      : undefined
                  }
                >
                  ⟳
                </span>
                {refreshing ? "刷新中…" : "刷新"}
              </button>
            </div>
          )}
        </div>
      </header>

      {!globalStats ? (
        <p className="text-sm animate-fade-in" style={{ color: "var(--text-muted)" }}>
          正在汇总运营数据…
        </p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 admin-stagger mb-8">
          <div className="admin-stat admin-stat--accent">
            <p className="admin-stat-label">累计签到</p>
            <p className="admin-stat-value">
              {globalStats.totalCheckinAmount.toLocaleString()}
            </p>
            <p className="admin-stat-hint">积分 · checkin 合计</p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat-label">累计消耗</p>
            <p className="admin-stat-value">
              {globalStats.totalConsumeAmount.toLocaleString()}
            </p>
            <p className="admin-stat-hint">
              ≈{" "}
              {Math.floor(
                globalStats.totalConsumeAmount / CREDIT_PER_IMAGE,
              ).toLocaleString()}{" "}
              张图
            </p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat-label">用户</p>
            <p className="admin-stat-value">{globalStats.totalUsers}</p>
            <p className="admin-stat-hint">
              {globalStats.bannedUsers > 0
                ? `封禁 ${globalStats.bannedUsers} 人`
                : "全部正常"}
            </p>
          </div>
          <div className="admin-stat">
            <p className="admin-stat-label">生成图片</p>
            <p className="admin-stat-value">
              {globalStats.totalImages.toLocaleString()}
            </p>
            <p className="admin-stat-hint">历史落盘合计</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 items-start admin-stagger">
        <AdminSiteSettingsCard />
        <AdminAnnouncementsCard />
      </div>

      {/* 风格库：新增/编辑/上架下架 */}
      <div className="mt-4 admin-stagger">
        <AdminStylesCard />
      </div>

      {/* 风格测试：管理员验证生图风格后再开放给用户 */}
      <div className="mt-4 admin-stagger">
        <AdminStyleTestCard />
      </div>
    </div>
  );
}
