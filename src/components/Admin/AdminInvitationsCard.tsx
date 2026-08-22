"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";

interface AdminInvitationRow {
  id: string;
  inviterUsername: string;
  inviteeUsername: string;
  rewardAmount: number;
  inviteeRewardAmount: number;
  createdAt: string | null;
  inviterStatus: string;
  inviteeStatus: string;
}

interface AdminInvitationData {
  stats: {
    totalInvitations: number;
    totalReward: number;
    totalInviteeReward: number;
  };
  invitations: AdminInvitationRow[];
  pagination: {
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

const PAGE_SIZE = 50;

function statusLabel(status: string): string {
  if (status === "active") return "正常";
  if (status === "banned") return "封禁";
  if (status === "deleted") return "已删除";
  return status || "未知";
}

function statusColor(status: string): string {
  if (status === "active") return "var(--success)";
  if (status === "banned") return "var(--danger)";
  return "var(--text-muted)";
}

export default function AdminInvitationsCard() {
  const [data, setData] = useState<AdminInvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const pageLoading = loading || (data !== null && data.pagination.offset !== offset);

  useEffect(() => {
    let cancelled = false;
    apiJson<AdminInvitationData>(
      `/api/admin/invitations?limit=${PAGE_SIZE}&offset=${offset}`,
    )
      .then((next) => {
        if (!cancelled) {
          setError("");
          setData(next);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset]);

  return (
    <section className="admin-card lg:col-span-2">
      <div className="admin-card-head">
        <div>
          <p className="admin-kicker">Invitations</p>
          <h2 className="admin-title text-lg mt-1">邀请记录</h2>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            展示成功注册的邀请关系；修改奖励只影响后续注册。
          </p>
        </div>
      </div>
      <div className="admin-card-body">
        {loading ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            加载邀请记录…
          </p>
        ) : error ? (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : !data ? null : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div
                className="rounded-[var(--radius)] px-3.5 py-3"
                style={{ background: "var(--bg-root)", border: "1px solid var(--border)" }}
              >
                <p className="admin-stat-label">成功邀请</p>
                <p className="admin-stat-value">{data.stats.totalInvitations}</p>
                <p className="admin-stat-hint">已完成注册</p>
              </div>
              <div
                className="rounded-[var(--radius)] px-3.5 py-3"
                style={{ background: "var(--bg-root)", border: "1px solid var(--border)" }}
              >
                <p className="admin-stat-label">累计发放</p>
                <p className="admin-stat-value">{data.stats.totalReward}</p>
                <p className="admin-stat-hint">邀请奖励积分</p>
              </div>
              <div
                className="rounded-[var(--radius)] px-3.5 py-3"
                style={{ background: "var(--bg-root)", border: "1px solid var(--border)" }}
              >
                <p className="admin-stat-label">被邀请人累计发放</p>
                <p className="admin-stat-value">{data.stats.totalInviteeReward}</p>
                <p className="admin-stat-hint">被邀请人额外奖励积分</p>
              </div>
            </div>

            {data.invitations.length === 0 ? (
              <p className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                暂无成功邀请记录
              </p>
            ) : (
              <div className="max-h-[22rem] overflow-auto rounded-[var(--radius)] border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full min-w-[40rem] text-left text-xs">
                  <thead
                    className="sticky top-0"
                    style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
                  >
                    <tr>
                      <th className="px-3 py-2 font-medium">邀请人</th>
                      <th className="px-3 py-2 font-medium">被邀请人</th>
                      <th className="px-3 py-2 font-medium">奖励</th>
                      <th className="px-3 py-2 font-medium">状态</th>
                      <th className="px-3 py-2 font-medium">注册时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invitations.map((row) => (
                      <tr key={row.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>
                          {row.inviterUsername}
                        </td>
                        <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                          {row.inviteeUsername}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums" style={{ color: "var(--accent)" }}>
                          <div>邀请人 +{row.rewardAmount}</div>
                          <div style={{ color: "var(--text-secondary)" }}>
                            被邀请人 +{row.inviteeRewardAmount}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[10px]">
                          <span style={{ color: statusColor(row.inviterStatus) }}>
                            邀请人：{statusLabel(row.inviterStatus)}
                          </span>
                          <br />
                          <span style={{ color: statusColor(row.inviteeStatus) }}>
                            被邀请人：{statusLabel(row.inviteeStatus)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums" style={{ color: "var(--text-muted)" }}>
                          {row.createdAt ? new Date(row.createdAt).toLocaleString("zh-CN") : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.invitations.length > 0 && (
              <div className="mt-3 flex items-center justify-between gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>
                  已显示 {data.pagination.offset + 1}–{data.pagination.offset + data.invitations.length} 条，共 {data.stats.totalInvitations} 条
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    disabled={offset === 0 || pageLoading}
                    onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    disabled={!data.pagination.hasMore || pageLoading}
                    onClick={() => {
                      if (data.pagination.nextOffset !== null) {
                        setOffset(data.pagination.nextOffset);
                      }
                    }}
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
