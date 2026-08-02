"use client";

import { useCallback, useState } from "react";
import Header from "@/components/Header";
import ImageGenView from "@/components/ImageGen/ImageGenView";
import AppModals from "@/components/AppModals";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { useAppActions } from "@/hooks/useAppActions";
import { ApiError, apiJson } from "@/lib/client-api";
import { CHECKIN_REWARD, type ImageRecord } from "@/types";

/**
 * 首页只负责布局拼装；状态在 store，业务在 useAppActions。
 * 平台仅提供文生图；配置类操作仅管理员可用。
 */
export default function Home() {
  const { user, logout } = useAuth();
  const actions = useAppActions();
  const { toast } = useToast();
  const [checkinLoading, setCheckinLoading] = useState(false);
  // 结果区当前展示的图片（与顶部菜单「生图记录」联动）
  const [activeImage, setActiveImage] = useState<ImageRecord | null>(null);
  // 手机端：当前 Tab 与抽屉侧栏
  const [mobileTab, setMobileTab] = useState<
    "generate" | "gallery" | "announcements"
  >("generate");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    config,
    imageHistory,
    generating,
    credits,
    checkinEligible,
    todayChecked,
    setCredits,
    setCheckinStatus,
    setSettingsOpen,
    setWalletOpen,
  } = useDeepRoastStore();

  const handleCheckin = useCallback(async () => {
    if (!checkinEligible || todayChecked || checkinLoading) return;
    setCheckinLoading(true);
    try {
      const data = await apiJson<{
        credits: number;
        reward?: number;
        todayChecked?: boolean;
      }>("/api/credits/checkin", { method: "POST" });
      setCredits(data.credits);
      setCheckinStatus({ todayChecked: true, eligible: true });
      toast(`签到成功，+${data.reward ?? CHECKIN_REWARD} 积分`, "success");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        toast(err.message || "签到失败", "error");
        if (err.message.includes("已签到")) {
          setCheckinStatus({ todayChecked: true });
        }
      } else {
        toast("网络错误", "error");
      }
    }
    setCheckinLoading(false);
  }, [
    checkinEligible,
    todayChecked,
    checkinLoading,
    setCredits,
    setCheckinStatus,
    toast,
  ]);

  const currentModel = config.imageModel;
  const hasApiKey = !!config.hasApiKey;
  const role = user?.role || "user";
  const isAdmin = role === "admin";

  // 删除图片时若正在结果区展示，同步清空
  const handleDeleteImage = useCallback(
    async (id: string) => {
      setActiveImage((prev) => (prev?.id === id ? null : prev));
      await actions.handleDeleteImage(id);
    },
    [actions, setActiveImage],
  );

  return (
    <div className="h-dvh flex flex-col" style={{ background: "var(--bg-root)" }}>
      <Header
        currentModel={currentModel}
        onSettingsClick={() => setSettingsOpen(true)}
        username={user?.username || ""}
        role={role}
        onLogout={logout}
        credits={credits}
        checkinEligible={checkinEligible}
        todayChecked={todayChecked}
        checkinLoading={checkinLoading}
        onCheckinClick={handleCheckin}
        onWalletClick={() => setWalletOpen(true)}
        onMenuClick={() => setDrawerOpen(true)}
      />

      {!hasApiKey && (
        <div
          className="border-b px-6 py-2 text-center text-xs font-medium"
          style={{
            background: "var(--accent-surface)",
            borderColor: "var(--border-strong)",
            color: "var(--accent)",
          }}
        >
          {isAdmin
            ? "未配置 API Key — 点击右上角齿轮完成设置"
            : "生图服务暂未配置 — 请联系管理员"}
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <ImageGenView
          model={config.imageModel}
          onGenerate={actions.handleGenerateImage}
          onStopGenerate={actions.handleStopGenerateImage}
          generating={generating}
          history={imageHistory}
          activeImage={activeImage}
          onActiveImageChange={setActiveImage}
          onDeleteImage={handleDeleteImage}
          credits={credits}
          isAdmin={isAdmin}
          checkinEligible={checkinEligible}
          todayChecked={todayChecked}
          onCheckinClick={handleCheckin}
          onWalletClick={() => setWalletOpen(true)}
          mobileTab={mobileTab}
          onMobileTabChange={setMobileTab}
          drawerOpen={drawerOpen}
          onDrawerClose={() => setDrawerOpen(false)}
        />
      </div>

      <AppModals
        onSaveConfig={actions.handleSaveConfig}
        role={role}
        checkinLoading={checkinLoading}
        onCheckinClick={handleCheckin}
      />
    </div>
  );
}
