"use client";

import { useCallback, useEffect, useState } from "react";
import AppModals from "@/components/AppModals";
import { useAuth } from "@/components/AuthProvider";
import TextModePanel from "@/components/Chat/TextModePanel";
import Header from "@/components/Header";
import ImageGenView from "@/components/ImageGen/ImageGenView";
import MobileDrawer from "@/components/ImageGen/MobileDrawer";
import { useToast } from "@/components/Toast";
import AppShell from "@/components/Workspace/AppShell";
import { useAppActions } from "@/hooks/useAppActions";
import { ApiError, apiJson } from "@/lib/client-api";
import { useDeepRoastStore } from "@/lib/store";
import {
  parseStoredBoolean,
  parseStoredWorkspaceMode,
  type WorkspaceMode,
} from "@/lib/workspace-preferences";
import { CHECKIN_REWARD, type ImageRecord } from "@/types";

const WORKSPACE_STORAGE_KEY = "deep-roast-workspace";
const INSPECTOR_COLLAPSED_STORAGE_KEY =
  "deep-roast-inspector-collapsed";

/** 首页只负责工作区布局；状态在 store，业务在 useAppActions。 */
export default function Home() {
  const { user, logout } = useAuth();
  const actions = useAppActions();
  const { toast } = useToast();
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<
    "generate" | "gallery" | "announcements"
  >("generate");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);

  const {
    activeMode,
    setActiveMode,
    setInspectorCollapsed,
    activeImageId,
    setActiveImageId,
    config,
    selectedImageModel,
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
    setWalletOpen,
  } = useDeepRoastStore();

  useEffect(() => {
    setActiveMode(
      parseStoredWorkspaceMode(
        window.localStorage.getItem(WORKSPACE_STORAGE_KEY),
      ),
    );
    setInspectorCollapsed(
      parseStoredBoolean(
        window.localStorage.getItem(INSPECTOR_COLLAPSED_STORAGE_KEY),
        false,
      ),
    );

    return useDeepRoastStore.subscribe((state, previousState) => {
      if (state.activeMode !== previousState.activeMode) {
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, state.activeMode);
      }
      if (state.inspectorCollapsed !== previousState.inspectorCollapsed) {
        window.localStorage.setItem(
          INSPECTOR_COLLAPSED_STORAGE_KEY,
          String(state.inspectorCollapsed),
        );
      }
    });
  }, [setActiveMode, setInspectorCollapsed]);

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
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        toast(error.message || "签到失败", "error");
        if (error.message.includes("已签到")) {
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

  const currentModel =
    selectedImageModel && config.enabledImageModels?.includes(selectedImageModel)
      ? selectedImageModel
      : config.imageModel;
  const activeImage = activeImageId
    ? imageHistory.find((image) => image.id === activeImageId) ?? null
    : null;
  const hasApiKey = Boolean(config.hasApiKey);
  const role = user?.role || "user";
  const isAdmin = role === "admin";

  const handleActiveImageChange = useCallback(
    (image: ImageRecord | null) => {
      setActiveImageId(image?.id ?? null);
    },
    [setActiveImageId],
  );

  const handleDeleteImage = useCallback(
    async (id: string) => {
      if (activeImageId === id) setActiveImageId(null);
      await actions.handleDeleteImage(id);
    },
    [actions, activeImageId, setActiveImageId],
  );

  const handleModeChange = useCallback(
    (mode: WorkspaceMode) => {
      setActiveMode(mode);
      setDrawerOpen(false);
      setChatSidebarOpen(false);
    },
    [setActiveMode],
  );

  const handleMenuClick = useCallback(() => {
    if (activeMode === "chat") {
      setChatSidebarOpen(true);
    } else {
      setDrawerOpen(true);
    }
  }, [activeMode]);

  const handleSelectImageTab = useCallback(
    (tab: "generate" | "gallery" | "announcements") => {
      setActiveMode("image");
      setMobileTab(tab);
      setDrawerOpen(false);
      setChatSidebarOpen(false);
    },
    [setActiveMode],
  );

  const handleSwitchChat = useCallback(() => {
    setActiveMode("chat");
    setDrawerOpen(false);
  }, [setActiveMode]);

  const handleSwitchImage = useCallback(() => {
    setActiveMode("image");
    setChatSidebarOpen(false);
  }, [setActiveMode]);

  const header = (
    <Header
      activeMode={activeMode}
      onModeChange={handleModeChange}
      username={user?.username || ""}
      role={role}
      onLogout={logout}
      credits={credits}
      onWalletClick={() => setWalletOpen(true)}
      onMenuClick={handleMenuClick}
    />
  );

  return (
    <AppShell header={header}>
      <div className="workspace-content">
        {!hasApiKey ? (
          <div
            className="border-b px-6 py-2 text-center text-xs font-medium"
            style={{
              background: "var(--accent-surface)",
              borderColor: "var(--border-strong)",
              color: "var(--accent)",
            }}
          >
            {isAdmin
              ? "未配置 API Key — 请从管理控制台完成设置"
              : "生图服务暂未配置 — 请联系管理员"}
          </div>
        ) : null}

        <div className="workspace-stage">
          <section
            className={`workspace-view ${
              activeMode === "image" ? "is-active" : ""
            }`}
            aria-label="生图工作区"
            aria-hidden={activeMode !== "image"}
            inert={activeMode !== "image"}
          >
            <ImageGenView
              model={currentModel}
              onGenerate={actions.handleGenerateImageBatch}
              onEditImage={actions.handleEditImage}
              onEditImageBatch={actions.handleEditImageBatch}
              onStopGenerate={actions.handleStopGenerateImage}
              onRetryGenerate={actions.handleRetryImageTask}
              generating={generating}
              history={imageHistory}
              activeImage={activeImage}
              onActiveImageChange={handleActiveImageChange}
              onDeleteImage={handleDeleteImage}
              credits={credits}
              isAdmin={isAdmin}
              onWalletClick={() => setWalletOpen(true)}
              mobileTab={mobileTab}
            />
          </section>

          <section
            className={`workspace-view ${
              activeMode === "chat" ? "is-active" : ""
            }`}
            aria-label="对话工作区"
            aria-hidden={activeMode !== "chat"}
            inert={activeMode !== "chat"}
          >
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
              sidebarOpen={chatSidebarOpen}
              onSidebarClose={() => setChatSidebarOpen(false)}
              onSwitchImage={handleSwitchImage}
            />
          </section>
        </div>

        <MobileDrawer
          open={drawerOpen}
          activeMode={activeMode}
          tab={mobileTab}
          historyCount={imageHistory.length}
          chatCount={conversations.length}
          onSelectImageTab={handleSelectImageTab}
          onSwitchChat={handleSwitchChat}
          onClose={() => setDrawerOpen(false)}
        />

        <AppModals
          onSaveConfig={actions.handleSaveConfig}
          role={role}
          checkinLoading={checkinLoading}
          onCheckinClick={handleCheckin}
        />
      </div>
    </AppShell>
  );
}
