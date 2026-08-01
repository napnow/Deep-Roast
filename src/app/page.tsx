"use client";

import { useCallback, useState, startTransition } from "react";
import Header from "@/components/Header";
import TextModePanel from "@/components/Chat/TextModePanel";
import ImageGenView from "@/components/ImageGen/ImageGenView";
import AppModals from "@/components/AppModals";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { useDeepRoastStore } from "@/lib/store";
import { useAppActions } from "@/hooks/useAppActions";
import { ApiError, apiJson } from "@/lib/client-api";
import { CHECKIN_REWARD } from "@/types";

/**
 * 首页只负责布局拼装；状态在 store，业务在 useAppActions。
 */
export default function Home() {
  const { user, logout } = useAuth();
  const actions = useAppActions();
  const { toast } = useToast();
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    activeMode,
    setActiveMode: rawSetActiveMode,
    config,
    textModels,
    imageModels,
    conversations,
    activeConvId,
    chatMessages,
    streaming,
    streamingText,
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

  // 用 startTransition 包装模式切换，减少 "Transition was skipped" 的概率
  const setActiveMode = useCallback((mode: "text" | "image") => {
    startTransition(() => {
      rawSetActiveMode(mode);
    });
  }, [rawSetActiveMode]);

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

  // 文生文：有当前会话时显示会话绑定的模型（实际对话用的就是它）
  const activeConv =
    activeMode === "text" && activeConvId
      ? conversations.find((c) => c.id === activeConvId)
      : undefined;
  const currentModel =
    activeMode === "text"
      ? activeConv?.model || config.textModel
      : config.imageModel;
  // 当前模型若不在列表中（历史会话自定义 id），补进列表避免选中态丢失
  const baseModels = activeMode === "text" ? textModels : imageModels;
  const currentModels =
    currentModel && !baseModels.some((m) => m.id === currentModel)
      ? [{ id: currentModel }, ...baseModels]
      : baseModels;
  const hasApiKey = !!config.hasApiKey;
  const role = user?.role || "user";

  return (
    <div className="h-dvh flex flex-col" style={{ background: "var(--bg-root)" }}>
      <Header
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        currentModel={currentModel}
        models={currentModels}
        onModelChange={actions.handleModelChange}
        onModelRemove={actions.handleModelRemove}
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
        onMenuClick={() => setSidebarOpen(true)}
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
          未配置 API Key — 点击右上角齿轮完成设置
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <div key={activeMode} className="flex-1 flex min-h-0 mode-panel-enter">
          {activeMode === "text" ? (
            <TextModePanel
              conversations={conversations}
              activeConvId={activeConvId}
              chatMessages={chatMessages}
              streaming={streaming}
              streamingText={streamingText}
              onSelect={actions.handleSelectConversation}
              onNew={actions.handleNewConversation}
              onDelete={actions.handleDeleteConversation}
              onRename={actions.handleRenameConversation}
              onSend={actions.handleSendMessage}
              onStop={actions.handleStopChat}
              sidebarOpen={sidebarOpen}
              onSidebarClose={() => setSidebarOpen(false)}
            />
          ) : (
            <ImageGenView
              model={config.imageModel}
              onGenerate={actions.handleGenerateImage}
              onStopGenerate={actions.handleStopGenerateImage}
              generating={generating}
              history={imageHistory}
              onDeleteImage={actions.handleDeleteImage}
              credits={credits}
              isAdmin={role === "admin"}
              checkinEligible={checkinEligible}
              todayChecked={todayChecked}
              onCheckinClick={handleCheckin}
              onWalletClick={() => setWalletOpen(true)}
            />
          )}
        </div>
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
