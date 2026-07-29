"use client";

import AdminSiteSettingsCard from "@/components/Admin/AdminSiteSettingsCard";
import AdminAnnouncementsCard from "@/components/Admin/AdminAnnouncementsCard";
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
}

export default function AdminDashboard({ globalStats }: AdminDashboardProps) {
  return (
    <div className="flex items-start justify-center h-full py-8">
      <div className="text-center max-w-lg w-full space-y-4 animate-fade-up px-4">
        <p
          className="text-sm font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          运营概览
        </p>
        {!globalStats ? (
          <p style={{ color: "var(--text-muted)" }} className="text-sm">
            加载统计数据...
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="累计签到积分"
              value={globalStats.totalCheckinAmount.toLocaleString()}
              hint="checkin 流水合计"
              accent
            />
            <StatCard
              label="累计消耗积分"
              value={globalStats.totalConsumeAmount.toLocaleString()}
              hint={`≈ ${Math.floor(globalStats.totalConsumeAmount / CREDIT_PER_IMAGE)} 张图`}
            />
            <StatCard
              label="总用户数"
              value={String(globalStats.totalUsers)}
              hint={
                globalStats.bannedUsers > 0
                  ? `其中封禁 ${globalStats.bannedUsers}`
                  : "人"
              }
            />
            <StatCard
              label="总生成图片"
              value={globalStats.totalImages.toLocaleString()}
              hint="张"
            />
          </div>
        )}
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          👈 选择左侧用户查看详细记录
        </p>

        <AdminSiteSettingsCard />
        <AdminAnnouncementsCard />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-4 text-left"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border)",
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-bold mt-1"
        style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}
      >
        {value}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        {hint}
      </p>
    </div>
  );
}
